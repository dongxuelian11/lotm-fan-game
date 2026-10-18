import type { ErrorAscentOwnedEngine } from '../error-ascent/engine.js';
import type { ErrorAscentProjection } from '../error-ascent/types.js';
import type { ErrorAscentRuntimeDraft, ErrorAscentRuntimeIdentity, ErrorAscentRuntimeSession } from '../error-ascent/owned-session.js';
import { openValidatedErrorAscentSlice, assertValidOwnedErrorAscentTransition } from './validation.js';
import { createErrorAscentState, applyErrorAscentCommand, errorAscentCommandBlock, projectErrorAscent, hasErrorAscentLock, hasErrorAscentHistory, errorAscentSourceView, applyOwnedErrorAscentCommand, ownedErrorAscentCommandBlock, projectOwnedErrorAscent, assertOwnedErrorAscentCurrent } from '../error-ascent/index.js';
import type { DoorOwnedEngine } from '../door/engine.js';
import type { DoorProjection } from '../door/types.js';
import type { DoorRuntimeDraft, DoorRuntimeIdentity, DoorRuntimeSession } from '../door/owned-session.js';
import { openValidatedDoorSlice, assertValidOwnedDoorTransition } from './validation.js';
import { createDoorState, applyDoorCommand, doorCommandBlock, projectDoor, hasDoorLock, hasDoorHistory, doorSourceView, applyOwnedDoorCommand, ownedDoorCommandBlock, projectOwnedDoor, assertOwnedDoorCurrent } from '../door/index.js';
import type { DeathOwnedEngine } from '../death/engine.js';
import type { DeathProjection } from '../death/types.js';
import type { DeathRuntimeDraft, DeathRuntimeIdentity, DeathRuntimeSession } from '../death/owned-session.js';
import { openValidatedDeathSlice, assertValidOwnedDeathTransition } from './validation.js';
import { createDeathState, applyDeathCommand, deathCommandBlock, projectDeath, hasDeathLock, hasDeathHistory, deathSourceView, applyOwnedDeathCommand, ownedDeathCommandBlock, projectOwnedDeath, assertOwnedDeathCurrent } from '../death/index.js';
import { projectPureWhiteAngelRoundOutcome } from "../pure-white-angel/combat.js";
import { projectLightSeekerRoundOutcome } from "../light-seeker/combat.js";
import type { SunOwnedEngine } from '../sun/engine.js';
import type { SunProjection } from '../sun/types.js';
import type { SunRuntimeDraft, SunRuntimeIdentity, SunRuntimeSession } from '../sun/owned-session.js';
import { openValidatedSunSlice, assertValidOwnedSunTransition } from './validation.js';
import { createSunState, applySunCommand, sunCommandBlock, projectSun, hasSunLock, hasSunHistory, sunSourceView, applyOwnedSunCommand, ownedSunCommandBlock, projectOwnedSun, assertOwnedSunCurrent } from '../sun/index.js';
import type { TyrantOwnedEngine } from '../tyrant/engine.js';
import type { TyrantProjection } from '../tyrant/types.js';
import type { TyrantRuntimeDraft, TyrantRuntimeIdentity, TyrantRuntimeSession } from '../tyrant/owned-session.js';
import { openValidatedTyrantSlice, assertValidOwnedTyrantTransition } from './validation.js';
import { createTyrantState, applyTyrantCommand, tyrantCommandBlock, projectTyrant, hasTyrantLock, hasTyrantHistory, tyrantSourceView, applyOwnedTyrantCommand, ownedTyrantCommandBlock, projectOwnedTyrant, assertOwnedTyrantCurrent } from '../tyrant/index.js';
import type { WhiteTowerOwnedEngine } from '../white-tower/engine.js';
import type { WhiteTowerProjection } from '../white-tower/types.js';
import type { WhiteTowerRuntimeDraft, WhiteTowerRuntimeIdentity, WhiteTowerRuntimeSession } from '../white-tower/owned-session.js';
import { openValidatedWhiteTowerSlice, assertValidOwnedWhiteTowerTransition } from './validation.js';
import { createWhiteTowerState, applyWhiteTowerCommand, whiteTowerCommandBlock, projectWhiteTower, hasWhiteTowerLock, hasWhiteTowerHistory, whiteTowerSourceView, applyOwnedWhiteTowerCommand, ownedWhiteTowerCommandBlock, projectOwnedWhiteTower, assertOwnedWhiteTowerCurrent } from '../white-tower/index.js';
import type { DarknessOwnedEngine } from '../darkness/engine.js';
import type { DarknessProjection } from '../darkness/types.js';
import type { DarknessRuntimeDraft, DarknessRuntimeIdentity, DarknessRuntimeSession } from '../darkness/owned-session.js';
import { openValidatedDarknessSlice, assertValidOwnedDarknessTransition } from './validation.js';
import { createDarknessState, applyDarknessCommand, darknessCommandBlock, projectDarkness, hasDarknessLock, hasDarknessHistory, darknessSourceView, applyOwnedDarknessCommand, ownedDarknessCommandBlock, projectOwnedDarkness, assertOwnedDarknessCurrent } from '../darkness/index.js';
import { projectBeautyGoddessRoundOutcome, projectBeautyGoddessPublicCombat } from '../beauty-goddess/public.js';
import type { MoonOwnedEngine } from '../moon/engine.js';
import type { MoonProjection } from '../moon/types.js';
import type { MoonRuntimeDraft, MoonRuntimeIdentity, MoonRuntimeSession } from '../moon/owned-session.js';
import { openValidatedMoonSlice, assertValidOwnedMoonTransition } from './validation.js';
import { createMoonState, applyMoonCommand, moonCommandBlock, projectMoon, hasMoonLock, hasMoonHistory, moonSourceView, applyOwnedMoonCommand, ownedMoonCommandBlock, projectOwnedMoon, assertOwnedMoonCurrent } from '../moon/index.js';
import type { PerfecterOwnedEngine } from '../perfecter/engine.js';
import type { PerfecterProjection } from '../perfecter/types.js';
import type { PerfecterRuntimeDraft, PerfecterRuntimeIdentity, PerfecterRuntimeSession } from '../perfecter/owned-session.js';
import { openValidatedPerfecterSlice, assertValidOwnedPerfecterTransition } from './validation.js';
import { createPerfecterState, applyPerfecterCommand, perfecterCommandBlock, projectPerfecter, hasPerfecterLock, hasPerfecterHistory, perfecterSourceView, applyOwnedPerfecterCommand, ownedPerfecterCommandBlock, projectOwnedPerfecter, assertOwnedPerfecterCurrent } from '../perfecter/index.js';
import type { VisionaryOwnedEngine } from '../visionary/engine.js';
import type { VisionaryProjection } from '../visionary/types.js';
import type { VisionaryRuntimeDraft, VisionaryRuntimeIdentity, VisionaryRuntimeSession } from '../visionary/owned-session.js';
import { openValidatedVisionarySlice, assertValidOwnedVisionaryTransition } from './validation.js';
import { createVisionaryState, applyVisionaryCommand, visionaryCommandBlock, projectVisionary, hasVisionaryLock, hasVisionaryHistory, visionarySourceView, applyOwnedVisionaryCommand, ownedVisionaryCommandBlock, projectOwnedVisionary, assertOwnedVisionaryCurrent } from '../visionary/index.js';
import type { RedPriestOwnedEngine } from '../red-priest/engine.js';
import type { RedPriestProjection } from '../red-priest/types.js';
import type { RedPriestRuntimeDraft, RedPriestRuntimeIdentity, RedPriestRuntimeSession } from '../red-priest/owned-session.js';
import { openValidatedRedPriestSlice, assertValidOwnedRedPriestTransition } from './validation.js';
import { createRedPriestState, applyRedPriestCommand, redPriestCommandBlock, projectRedPriest, hasRedPriestLock, hasRedPriestHistory, redPriestSourceView, applyOwnedRedPriestCommand, ownedRedPriestCommandBlock, projectOwnedRedPriest, assertOwnedRedPriestCurrent } from '../red-priest/index.js';
import type { FoolOwnedEngine } from '../fool/engine.js';
import type { FoolProjection } from '../fool/types.js';
import type { FoolRuntimeDraft, FoolRuntimeIdentity, FoolRuntimeSession } from '../fool/owned-session.js';
import { openValidatedFoolSlice, assertValidOwnedFoolTransition, validateSlicePayload } from './validation.js';
import { createFoolState, applyFoolCommand, foolCommandBlock, projectFool, hasFoolLock, hasFoolHistory, foolSourceView, applyOwnedFoolCommand, ownedFoolCommandBlock, projectOwnedFool, assertOwnedFoolCurrent } from '../fool/index.js';
import { createNatureWalkerState, applyNatureWalkerCommand, projectNatureWalker, hasNatureWalkerLock, natureWalkerInheritedView } from '../nature-walker/index.js';
import { settleNatureWalkerEncounter } from '../nature-walker/encounter.js';
import { projectNatureWalkerCombat, projectNatureWalkerRoundOutcome, NATURE_WALKER_ENEMY_COUNT_WHEEL, NATURE_WALKER_ENEMY_ABILITY_WHEEL } from '../nature-walker/combat.js';
import { createHandOfOrderState, applyHandOfOrderCommand, projectHandOfOrder, hasHandOfOrderLock, handOfOrderInheritedView } from '../hand-of-order/index.js';
import { settleHandOfOrderEncounter } from '../hand-of-order/encounter.js';
import { projectHandOfOrderCombat, projectHandOfOrderRoundOutcome, HAND_OF_ORDER_ENEMY_COUNT_WHEEL, HAND_OF_ORDER_ENEMY_ABILITY_WHEEL } from '../hand-of-order/combat.js';
import type { SlicePublicCombatRound } from './types.js';
import { createPrinceOfAbolitionState, applyPrinceOfAbolitionCommand, projectPrinceOfAbolition, hasPrinceOfAbolitionLock, princeOfAbolitionInheritedView } from '../prince-of-abolition/index.js';
import { settlePrinceOfAbolitionEncounter } from '../prince-of-abolition/encounter.js';
import { projectPrinceOfAbolitionCombat, projectPrinceOfAbolitionRoundOutcome, PRINCE_OF_ABOLITION_ENEMY_COUNT_WHEEL, PRINCE_OF_ABOLITION_ENEMY_ABILITY_WHEEL } from '../prince-of-abolition/combat.js';
import { createMercurySnakeState, applyMercurySnakeCommand, projectMercurySnake, hasMercurySnakeLock, mercurySnakeInheritedView } from '../mercury-snake/index.js';
import { settleMercurySnakeEncounter } from '../mercury-snake/encounter.js';
import { projectMercurySnakeCombat, MERCURY_SNAKE_ENEMY_COUNT_WHEEL, MERCURY_SNAKE_ENEMY_ABILITY_WHEEL } from '../mercury-snake/combat.js';
import { validateFerrymanEraCommand } from '../ferryman/era.js';
import { createPaleEmperorState, applyPaleEmperorCommand, projectPaleEmperor, hasPaleEmperorLock, recordPaleEmperorEraCommand } from '../pale-emperor/index.js';
import { settlePaleEmperorEncounter } from '../pale-emperor/encounter.js';
import { projectPaleEmperorCombat,projectPaleEmperorRoundOutcome, PALE_EMPEROR_ENEMY_COUNT_WHEEL, PALE_EMPEROR_ENEMY_ABILITY_WHEEL } from '../pale-emperor/combat.js';
import { createPureWhiteAngelState, applyPureWhiteAngelCommand, projectPureWhiteAngel, hasPureWhiteAngelLock } from '../pure-white-angel/index.js';
import { settlePureWhiteAngelEncounter } from '../pure-white-angel/encounter.js';
import { projectPureWhiteAngelCombat, PURE_WHITE_ANGEL_ENEMY_COUNT_WHEEL, PURE_WHITE_ANGEL_ENEMY_ABILITY_WHEEL } from '../pure-white-angel/combat.js';
import { createThunderGodState, applyThunderGodCommand, projectThunderGod, projectThunderGodLastCheck, hasThunderGodLock } from '../thunder-god/index.js';
import { settleThunderGodEncounter } from '../thunder-god/encounter.js';
import { projectThunderGodRoundOutcome, projectThunderGodCombat, THUNDER_GOD_ENEMY_COUNT_WHEEL, THUNDER_GOD_ENEMY_ABILITY_WHEEL } from '../thunder-god/combat.js';
import { createAbominationState, applyAbominationCommand, projectAbomination, hasAbominationLock, abominationInheritedView } from '../abomination/index.js';
import { createUncleanMonarchState, applyUncleanMonarchCommand, projectUncleanMonarch, hasUncleanMonarchLock } from '../unclean-monarch/index.js';
import { createDarkAngelState, applyDarkAngelCommand, projectDarkAngel, hasDarkAngelLock } from '../dark-angel/index.js';
import { createKnowledgeEmperorState, applyKnowledgeEmperorCommand, projectKnowledgeEmperor, hasKnowledgeEmperorLock } from '../knowledge-emperor/index.js';
import { createApocalypseDemonessState, applyApocalypseDemonessCommand, projectApocalypseDemoness, hasApocalypseDemonessLock } from '../apocalypse-demoness/index.js';
import { createDivineHandState, applyDivineHandCommand, projectDivineHand, hasDivineHandLock } from '../divine-hand/index.js';
import { createTimeWormState, applyTimeWormCommand, projectTimeWorm, hasTimeWormLock, timeWormInheritedView } from '../time-worm/index.js';
import { createStarKeyState, applyStarKeyCommand, projectStarKey, hasStarKeyLock, starKeyInheritedView } from '../star-key/index.js';
import { createAllKnowingEyeState, applyAllKnowingEyeCommand, projectAllKnowingEye, hasAllKnowingEyeLock } from '../all-knowing-eye/index.js';
import { settleAbominationEncounter } from '../abomination/encounter.js';
import { settleUncleanMonarchEncounter } from '../unclean-monarch/encounter.js';
import { settleDarkAngelEncounter } from '../dark-angel/encounter.js';
import { settleKnowledgeEmperorEncounter } from '../knowledge-emperor/encounter.js';
import { settleApocalypseDemonessEncounter } from '../apocalypse-demoness/encounter.js';
import { settleDivineHandEncounter } from '../divine-hand/encounter.js';
import { settleTimeWormEncounter } from '../time-worm/encounter.js';
import { settleStarKeyEncounter } from '../star-key/encounter.js';
import { settleAllKnowingEyeEncounter } from '../all-knowing-eye/encounter.js';
import { projectAbominationCombat, ABOMINATION_ENEMY_COUNT_WHEEL, ABOMINATION_ENEMY_ABILITY_WHEEL } from '../abomination/combat.js';
import { projectUncleanMonarchCombat, UNCLEAN_MONARCH_ENEMY_COUNT_WHEEL, UNCLEAN_MONARCH_ENEMY_ABILITY_WHEEL } from '../unclean-monarch/combat.js';
import { projectDarkAngelCombat, DARK_ANGEL_ENEMY_COUNT_WHEEL, DARK_ANGEL_ENEMY_ABILITY_WHEEL } from '../dark-angel/combat.js';
import { projectKnowledgeEmperorCombat, KNOWLEDGE_EMPEROR_ENEMY_COUNT_WHEEL, KNOWLEDGE_EMPEROR_ENEMY_ABILITY_WHEEL } from '../knowledge-emperor/combat.js';
import { projectApocalypseDemonessCombat, APOCALYPSE_DEMONESS_ENEMY_COUNT_WHEEL, APOCALYPSE_DEMONESS_ENEMY_ABILITY_WHEEL } from '../apocalypse-demoness/combat.js';
import { projectDivineHandCombat, DIVINE_HAND_ENEMY_COUNT_WHEEL, DIVINE_HAND_ENEMY_ABILITY_WHEEL } from '../divine-hand/combat.js';
import { projectTimeWormRoundOutcome } from '../time-worm/public.js';
import { projectFateTrojanRoundOutcome } from '../fate-trojan/public.js';
import { projectTimeWormCombat, TIME_WORM_ENEMY_COUNT_WHEEL, TIME_WORM_ENEMY_ABILITY_WHEEL } from '../time-worm/combat.js';
import { projectStarKeyRoundOutcome, projectStarKeyCombat, STAR_KEY_ENEMY_COUNT_WHEEL, STAR_KEY_ENEMY_ABILITY_WHEEL } from '../star-key/combat.js';
import { projectAllKnowingEyeRoundOutcome, projectAllKnowingEyeCombat, ALL_KNOWING_EYE_ENEMY_COUNT_WHEEL, ALL_KNOWING_EYE_ENEMY_ABILITY_WHEEL } from '../all-knowing-eye/combat.js';
import { createMisfortuneKnightState, applyMisfortuneKnightCommand, projectMisfortuneKnight, hasMisfortuneKnightLock } from '../misfortune-knight/index.js';
import { settleMisfortuneKnightEncounter } from '../misfortune-knight/encounter.js';
import { projectMisfortuneKnightCombat, projectMisfortuneKnightRoundOutcome, MISFORTUNE_KNIGHT_ENEMY_COUNT_WHEEL, MISFORTUNE_KNIGHT_ENEMY_ABILITY_WHEEL } from '../misfortune-knight/combat.js';
import { createBeautyGoddessState, applyBeautyGoddessCommand, projectBeautyGoddess, hasBeautyGoddessLock } from '../beauty-goddess/index.js';
import { settleBeautyGoddessEncounter } from '../beauty-goddess/encounter.js';
import { BEAUTY_GODDESS_ENEMY_COUNT_WHEEL, BEAUTY_GODDESS_ENEMY_ABILITY_WHEEL } from '../beauty-goddess/combat.js';
import { createCivilizationEnlightenerState, applyCivilizationEnlightenerCommand, projectCivilizationEnlightener, hasCivilizationEnlightenerLock, civilizationEnlightenerInheritedView } from '../civilization-enlightener/index.js';
import { settleCivilizationEnlightenerEncounter } from '../civilization-enlightener/encounter.js';
import { projectCivilizationEnlightenerCombat, projectCivilizationEnlightenerRoundOutcome, CIVILIZATION_ENLIGHTENER_ENEMY_COUNT_WHEEL, CIVILIZATION_ENLIGHTENER_ENEMY_ABILITY_WHEEL } from '../civilization-enlightener/combat.js';
import { createWriterState, applyWriterCommand, projectWriter, hasWriterLock } from '../writer/index.js';
import { settleWriterEncounter } from '../writer/encounter.js';
import { projectWriterCombat, projectWriterRoundOutcome, WRITER_ENEMY_COUNT_WHEEL, WRITER_ENEMY_ABILITY_WHEEL } from '../writer/combat.js';
import { createConquerorState, applyConquerorCommand, projectConqueror, hasConquerorLock } from '../conqueror/index.js';
import { settleConquerorEncounter } from '../conqueror/encounter.js';
import { projectConquerorCombat, projectConquerorRoundOutcome, CONQUEROR_ENEMY_COUNT_WHEEL, CONQUEROR_ENEMY_ABILITY_WHEEL } from '../conqueror/combat.js';
import { createAttendantMysteriesState, applyAttendantMysteriesCommand, projectAttendantMysteries, hasAttendantMysteriesLock } from '../attendant-mysteries/index.js';
import { hasAttendantMysteriesTownLock } from '../attendant-mysteries/ritual.js';
import { hasAttendantMysteriesLifeLock } from '../attendant-mysteries/life.js';
import { settleAttendantMysteriesEncounter } from '../attendant-mysteries/encounter.js';
import { projectAttendantMysteriesCombat, projectAttendantMysteriesRoundOutcome, ATTENDANT_MYSTERIES_ENEMY_COUNT_WHEEL, ATTENDANT_MYSTERIES_ENEMY_ABILITY_WHEEL } from '../attendant-mysteries/combat.js';
import { settleBarrenMatriarchEncounter } from '../barren-matriarch/encounter.js';
import { settleBalancerEncounter } from '../balancer/encounter.js';
import { settleEntropyDukeEncounter } from '../entropy-duke/encounter.js';
import { projectBarrenMatriarchCombat, BARREN_MATRIARCH_ENEMY_COUNT_WHEEL, BARREN_MATRIARCH_ENEMY_ABILITY_WHEEL } from '../barren-matriarch/combat.js';
import { projectBalancerCombat, BALANCER_ENEMY_COUNT_WHEEL, BALANCER_ENEMY_ABILITY_WHEEL } from '../balancer/combat.js';
import { projectEntropyDukeCombat, ENTROPY_DUKE_ENEMY_COUNT_WHEEL, ENTROPY_DUKE_ENEMY_ABILITY_WHEEL } from '../entropy-duke/combat.js';
import { createBarrenMatriarchState, applyBarrenMatriarchCommand, projectBarrenMatriarch, hasBarrenMatriarchLock } from '../barren-matriarch/index.js';
import { createBalancerState, applyBalancerCommand, projectBalancer, hasBalancerLock } from '../balancer/index.js';
import { createEntropyDukeState, applyEntropyDukeCommand, projectEntropyDuke, hasEntropyDukeLock } from '../entropy-duke/index.js';
import { settleFateProphetEncounter } from '../fate-prophet/encounter.js';
import { resolveSliceWeeklyFinance } from './weekly-finance.js';
import { projectFateProphetCombat, FATE_PROPHET_ENEMY_COUNT_WHEEL, FATE_PROPHET_ENEMY_ABILITY_WHEEL } from '../fate-prophet/combat.js';
import { createFateProphetState, applyFateProphetCommand, projectFateProphet, hasFateProphetLock } from '../fate-prophet/index.js';
import { settleAncientEvilEncounter } from '../ancient-evil/encounter.js';
import { projectAncientEvilCombat, ANCIENT_EVIL_ENEMY_COUNT_WHEEL, ANCIENT_EVIL_ENEMY_ABILITY_WHEEL } from '../ancient-evil/combat.js';
import { createAncientEvilState, applyAncientEvilCommand, projectAncientEvil, hasAncientEvilLock } from '../ancient-evil/index.js';
import { settleBloodDukeEncounter } from '../blood-duke/encounter.js';
import { projectBloodDukeCombat, BLOOD_DUKE_ENEMY_COUNT_WHEEL, BLOOD_DUKE_ENEMY_ABILITY_WHEEL } from '../blood-duke/combat.js';
import { createBloodDukeState, applyBloodDukeCommand, projectBloodDuke, hasBloodDukeLock } from '../blood-duke/index.js';
import { settleElderEncounter } from '../elder/encounter.js';
import { projectElderCombat, ELDER_ENEMY_COUNT_WHEEL, ELDER_ENEMY_ABILITY_WHEEL } from '../elder/combat.js';
import { createElderState, applyElderCommand, projectElder, hasElderLock } from '../elder/index.js';
import { projectPlayerText } from '../../shared/player-text.js';
import { settleSageEncounter } from '../sage/encounter.js';
import { settleCalamityDemonessEncounter } from '../calamity-demoness/encounter.js';
import { settleGloryEncounter } from '../glory/encounter.js';
import {settleFateTrojanEncounter} from '../fate-trojan/encounter.js';
import {settlePlaneswalkerEncounter} from '../planeswalker/encounter.js';
import {settleDeathConsulEncounter} from '../death-consul/encounter.js';
import {settleLightSeekerEncounter} from '../light-seeker/encounter.js';
import {settleCatastropheEncounter} from '../catastrophe/encounter.js';
import {settleWisdomAngelEncounter} from '../wisdom-angel/encounter.js';
import {settleConcealmentServantEncounter} from '../concealment-servant/encounter.js';
import {settleLifeGiverEncounter} from '../life-giver/encounter.js';
import {settleKnowledgeMentorEncounter} from '../knowledge-mentor/encounter.js';
import { projectSageCombat, SAGE_ENEMY_COUNT_WHEEL, SAGE_ENEMY_ABILITY_WHEEL } from '../sage/combat.js';
import { projectCalamityDemonessCombat, CALAMITY_DEMONESS_ENEMY_COUNT_WHEEL, CALAMITY_DEMONESS_ENEMY_ABILITY_WHEEL } from '../calamity-demoness/combat.js';
import { projectGloryCombat, GLORY_ENEMY_COUNT_WHEEL, GLORY_ENEMY_ABILITY_WHEEL } from '../glory/combat.js';
import {projectFateTrojanCombat,FATE_TROJAN_ENEMY_COUNT_WHEEL,FATE_TROJAN_ENEMY_ABILITY_WHEEL} from '../fate-trojan/combat.js';
import {projectPlaneswalkerRoundOutcome,projectPlaneswalkerCombat,PLANESWALKER_ENEMY_COUNT_WHEEL,PLANESWALKER_ENEMY_ABILITY_WHEEL} from '../planeswalker/combat.js';
import {projectDeathConsulCombat,projectDeathConsulRoundOutcome,DEATH_CONSUL_ENEMY_COUNT_WHEEL,DEATH_CONSUL_ENEMY_ABILITY_WHEEL} from '../death-consul/combat.js';
import {projectLightSeekerCombat,LIGHT_SEEKER_ENEMY_COUNT_WHEEL,LIGHT_SEEKER_ENEMY_ABILITY_WHEEL} from '../light-seeker/combat.js';
import {projectCatastropheCombat,CATASTROPHE_ENEMY_COUNT_WHEEL,CATASTROPHE_ENEMY_ABILITY_WHEEL} from '../catastrophe/combat.js';
import {projectWisdomAngelRoundOutcome,projectWisdomAngelCombat,WISDOM_ANGEL_ENEMY_COUNT_WHEEL,WISDOM_ANGEL_ENEMY_ABILITY_WHEEL} from '../wisdom-angel/combat.js';
import {projectConcealmentServantCombat,projectConcealmentServantRoundOutcome,CONCEALMENT_SERVANT_ENEMY_COUNT_WHEEL,CONCEALMENT_SERVANT_ENEMY_ABILITY_WHEEL} from '../concealment-servant/combat.js';
import {projectLifeGiverCombat,LIFE_GIVER_ENEMY_COUNT_WHEEL,LIFE_GIVER_ENEMY_ABILITY_WHEEL,type LifeGiverRoundOutcome} from '../life-giver/combat.js';
import {projectKnowledgeMentorCombat,projectKnowledgeMentorRoundOutcome,KNOWLEDGE_MENTOR_ENEMY_COUNT_WHEEL,KNOWLEDGE_MENTOR_ENEMY_ABILITY_WHEEL} from '../knowledge-mentor/combat.js';
import {ARCANE_SCHOLAR_ENEMY_COUNT_WHEEL,ARCANE_SCHOLAR_ENEMY_ABILITY_WHEEL} from '../arcane-scholar/combat.js';
import { createSageState, applySageCommand, projectSage, hasSageLock } from '../sage/index.js';
import { createCalamityDemonessState, applyCalamityDemonessCommand, projectCalamityDemoness, hasCalamityDemonessLock } from '../calamity-demoness/index.js';
import { createGloryState, applyGloryCommand, projectGlory, hasGloryLock } from '../glory/index.js';
import {createFateTrojanState,applyFateTrojanCommand,projectFateTrojan,hasFateTrojanLock} from '../fate-trojan/index.js';
import {createPlaneswalkerState,applyPlaneswalkerCommand,projectPlaneswalker,hasPlaneswalkerLock} from '../planeswalker/index.js';
import {createDeathConsulState,applyDeathConsulCommand,projectDeathConsul,hasDeathConsulLock} from '../death-consul/index.js';
import {createLightSeekerState,applyLightSeekerCommand,projectLightSeeker,hasLightSeekerLock} from '../light-seeker/index.js';
import {createCatastropheState,applyCatastropheCommand,projectCatastrophe,hasCatastropheLock} from '../catastrophe/index.js';
import {createWisdomAngelState,applyWisdomAngelCommand,projectWisdomAngel,hasWisdomAngelLock} from '../wisdom-angel/index.js';
import {createConcealmentServantState,applyConcealmentServantCommand,projectConcealmentServant,hasConcealmentServantLock} from '../concealment-servant/index.js';
import {createLifeGiverState,applyLifeGiverCommand,projectLifeGiver,hasLifeGiverLock} from '../life-giver/index.js';
import {createKnowledgeMentorState,applyKnowledgeMentorCommand,projectKnowledgeMentor,hasKnowledgeMentorLock} from '../knowledge-mentor/index.js';
import {settleDiscernerEncounter} from '../discerner/encounter.js';
import {projectDiscernerCombat,DISCERNER_ENEMY_COUNT_WHEEL,DISCERNER_ENEMY_ABILITY_WHEEL} from '../discerner/combat.js';
import {DREAM_WEAVER_ENEMY_COUNT_WHEEL,DREAM_WEAVER_ENEMY_ABILITY_WHEEL} from '../dream-weaver/combat.js';
import {createDiscernerState,applyDiscernerCommand,projectDiscerner,hasDiscernerLock} from '../discerner/index.js';
import {settleWeatherWarlockEncounter} from '../weather-warlock/encounter.js';
import {projectWeatherWarlockCombat,WEATHER_WARLOCK_ENEMY_COUNT_WHEEL,WEATHER_WARLOCK_ENEMY_ABILITY_WHEEL} from '../weather-warlock/combat.js';
import {createWeatherWarlockState,applyWeatherWarlockCommand,projectWeatherWarlock,hasWeatherWarlockLock} from '../weather-warlock/index.js';
import {settleMiracleWorkerEncounter} from '../miracle-worker/encounter.js';
import {projectMiracleWorkerCombat,MIRACLE_WORKER_ENEMY_COUNT_WHEEL,MIRACLE_WORKER_ENEMY_ABILITY_WHEEL} from '../miracle-worker/combat.js';
import {openMiracleWorkerRevival} from '../miracle-worker/revival.js';
import {createMiracleWorkerState,applyMiracleWorkerCommand,projectMiracleWorker,hasMiracleWorkerLock} from '../miracle-worker/index.js';
import {validateMiracleWorkerRevivalCommand} from '../miracle-worker/revival.js';
import { projectRecovery } from './medical.js';
import { nextLosingInjuryWeights } from './combat.js';
import {settleCoffinBearerEncounter} from '../coffin-bearer/encounter.js';
import {projectCoffinBearerCombat} from '../coffin-bearer/combat.js';
import {createCoffinBearerState,applyCoffinBearerCommand,projectCoffinBearer,hasCoffinBearerLock} from '../coffin-bearer/index.js';
import {settleChaosHunterEncounter} from '../chaos-hunter/encounter.js';
import {projectChaosHunterCombat} from '../chaos-hunter/combat.js';
import {createChaosHunterState,applyChaosHunterCommand,projectChaosHunter,hasChaosHunterLock} from '../chaos-hunter/index.js';
import {settleFrenzyMageEncounter} from '../frenzy-mage/encounter.js';
import {projectFrenzyMageCombat} from '../frenzy-mage/combat.js';
import {createFrenzyMageState,applyFrenzyMageCommand,projectFrenzyMage,hasFrenzyMageLock} from '../frenzy-mage/index.js';
import {settleChaosWalkerEncounter} from '../chaos-walker/encounter.js';
import {projectChaosWalkerCombat} from '../chaos-walker/combat.js';
import {createChaosWalkerState,applyChaosWalkerCommand,projectChaosWalker,hasChaosWalkerLock} from '../chaos-walker/index.js';
import {settleSilentDiscipleEncounter} from '../silent-disciple/encounter.js';
import {projectSilentDiscipleCombat} from '../silent-disciple/combat.js';
import {createSilentDiscipleState,applySilentDiscipleCommand,projectSilentDisciple,hasSilentDiscipleLock} from '../silent-disciple/index.js';
import {settleBlathererEncounter} from '../blatherer/encounter.js';
import {projectBlathererCombat} from '../blatherer/combat.js';
import {createBlathererState,applyBlathererCommand,projectBlatherer,hasBlathererLock} from '../blatherer/index.js';
import {settleThreeHeadedTemplarEncounter} from '../three-headed-templar/encounter.js';
import {projectThreeHeadedTemplarCombat} from '../three-headed-templar/combat.js';
import {createThreeHeadedTemplarState,applyThreeHeadedTemplarCommand,projectThreeHeadedTemplar,hasThreeHeadedTemplarLock} from '../three-headed-templar/index.js';
import {settleProphecyMasterEncounter} from '../prophecy-master/encounter.js';
import {projectProphecyMasterCombat} from '../prophecy-master/combat.js';
import {createProphecyMasterState,applyProphecyMasterCommand,projectProphecyMaster,hasProphecyMasterLock} from '../prophecy-master/index.js';
import {settleUnagingDemonessEncounter} from '../unaging-demoness/encounter.js';
import {projectUnagingDemonessCombat,UNAGING_DEMONESS_ENEMY_COUNT_WHEEL,UNAGING_DEMONESS_ENEMY_ABILITY_WHEEL} from '../unaging-demoness/combat.js';
import {createUnagingDemonessState,applyUnagingDemonessCommand,projectUnagingDemoness,hasUnagingDemonessLock} from '../unaging-demoness/index.js';
import {settleSilverKnightEncounter} from '../silver-knight/encounter.js';
import {projectSilverKnightCombat,SILVER_KNIGHT_ENEMY_COUNT_WHEEL,SILVER_KNIGHT_ENEMY_ABILITY_WHEEL} from '../silver-knight/combat.js';
import {createSilverKnightState,applySilverKnightCommand,projectSilverKnight,hasSilverKnightLock} from '../silver-knight/index.js';
import {settleDeceitMentorEncounter} from '../deceit-mentor/encounter.js';
import {projectDeceitMentorCombat,DECEIT_MENTOR_ENEMY_COUNT_WHEEL,DECEIT_MENTOR_ENEMY_ABILITY_WHEEL} from '../deceit-mentor/combat.js';
import {createDeceitMentorState,applyDeceitMentorCommand,projectDeceitMentor,hasDeceitMentorLock} from '../deceit-mentor/index.js';
import {settleWandererEncounter} from '../wanderer/encounter.js';
import {projectWandererCombat,WANDERER_ENEMY_COUNT_WHEEL,WANDERER_ENEMY_ABILITY_WHEEL} from '../wanderer/combat.js';
import {createWandererState,applyWandererCommand,projectWanderer,hasWandererLock} from '../wanderer/index.js';
import {settleFerrymanEncounter} from '../ferryman/encounter.js';
import {projectFerrymanCombat,projectFerrymanRoundOutcome} from '../ferryman/combat.js';
import {createFerrymanState,applyFerrymanCommand,projectFerryman,hasFerrymanLock} from '../ferryman/index.js';
import {settleJusticeMentorEncounter} from '../justice-mentor/encounter.js';
import {projectJusticeMentorCombat} from '../justice-mentor/combat.js';
import {createJusticeMentorState,applyJusticeMentorCommand,projectJusticeMentor,hasJusticeMentorLock} from '../justice-mentor/index.js';
import {settleSeaKingEncounter} from '../sea-king/encounter.js';
import {projectSeaKingRoundOutcome,projectSeaKingCombat,SEA_KING_ENEMY_COUNT_WHEEL,SEA_KING_ENEMY_ABILITY_WHEEL} from '../sea-king/combat.js';
import {createSeaKingState,applySeaKingCommand,projectSeaKing,hasSeaKingLock} from '../sea-king/index.js';
import {settleInsightScholarEncounter} from '../insight-scholar/encounter.js';
import {projectInsightScholarCombat,INSIGHT_SCHOLAR_ENEMY_COUNT_WHEEL,INSIGHT_SCHOLAR_ENEMY_ABILITY_WHEEL} from '../insight-scholar/combat.js';
import {createInsightScholarState,applyInsightScholarCommand,projectInsightScholar,hasInsightScholarLock} from '../insight-scholar/index.js';
import {settleFearBishopEncounter} from '../fear-bishop/encounter.js';
import {projectFearBishopCombat,projectFearBishopRoundOutcome,FEAR_BISHOP_ENEMY_COUNT_WHEEL,FEAR_BISHOP_ENEMY_ABILITY_WHEEL} from '../fear-bishop/combat.js';
import {createFearBishopState,applyFearBishopCommand,projectFearBishop,hasFearBishopLock} from '../fear-bishop/index.js';
import {settleSummoningMasterEncounter} from '../summoning-master/encounter.js';
import {projectSummoningMasterCombat,SUMMONING_MASTER_ENEMY_COUNT_WHEEL,SUMMONING_MASTER_ENEMY_ABILITY_WHEEL} from '../summoning-master/combat.js';
import {createSummoningMasterState,applySummoningMasterCommand,projectSummoningMaster,hasSummoningMasterLock} from '../summoning-master/index.js';
import {settleArcaneScholarEncounter} from '../arcane-scholar/encounter.js';
import {projectArcaneScholarCombat} from '../arcane-scholar/combat.js';
import {createArcaneScholarState,applyArcaneScholarCommand,projectArcaneScholar,hasArcaneScholarLock} from '../arcane-scholar/index.js';
import {settleDreamWeaverEncounter} from '../dream-weaver/encounter.js';
import {projectDreamWeaverCombat} from '../dream-weaver/combat.js';
import {createDreamWeaverState,applyDreamWeaverCommand,projectDreamWeaver,hasDreamWeaverLock} from '../dream-weaver/index.js';
import {settleWarBishopEncounter} from '../war-bishop/encounter.js';
import {projectWarBishopCombat,WAR_BISHOP_ENEMY_COUNT_WHEEL,WAR_BISHOP_ENEMY_ABILITY_WHEEL} from '../war-bishop/combat.js';
import {createWarBishopState,applyWarBishopCommand,projectWarBishop,hasWarBishopLock} from '../war-bishop/index.js';
import {settleAncientScholarEncounter} from '../ancient-scholar/encounter.js';
import {projectAncientScholarCombat} from '../ancient-scholar/combat.js';
import {createAncientScholarState,applyAncientScholarCommand,projectAncientScholar,hasAncientScholarLock,hasAncientScholarEraClosure} from '../ancient-scholar/index.js';
import {createLongChapterState,applyLongChapterCommand,projectLongChapter,hasLongChapterLock,hasLongChapterHandoff,isLongChapterEraClosed,longChapterBlocksOrdinaryPulse} from '../long-chapter/index.js';
import {createAncientAlchemistState,applyAncientAlchemistCommand,projectAncientAlchemist} from '../ancient-alchemist/index.js';
import {hasAncientAlchemistLifeLock} from '../ancient-alchemist/life.js';
import {hasAncientAlchemistEncounterLock,settleAncientAlchemistEncounter} from '../ancient-alchemist/encounter.js';
import {projectAncientAlchemistCombat} from '../ancient-alchemist/combat.js';
import {createImperativeMageState,applyImperativeMageCommand,projectImperativeMage} from '../imperative-mage/index.js';
import {hasImperativeMageLifeLock} from '../imperative-mage/life.js';
import {hasImperativeMageEncounterLock,settleImperativeMageEncounter} from '../imperative-mage/encounter.js';
import {projectImperativeMageCombat} from '../imperative-mage/combat.js';
import {createFallenEarlState,applyFallenEarlCommand,projectFallenEarl} from '../fallen-earl/index.js';
import {hasFallenEarlLifeLock} from '../fallen-earl/life.js';
import {hasFallenEarlEncounterLock,settleFallenEarlEncounter} from '../fallen-earl/encounter.js';
import {projectFallenEarlCombat} from '../fallen-earl/combat.js';
import {createMisfortuneMageState,applyMisfortuneMageCommand,projectMisfortuneMage} from '../misfortune-mage/index.js';
import {hasMisfortuneMageLifeLock} from '../misfortune-mage/life.js';
import {hasMisfortuneMageEncounterLock,settleMisfortuneMageEncounter} from '../misfortune-mage/encounter.js';
import {projectMisfortuneMageCombat} from '../misfortune-mage/combat.js';
import {createPuppetState,applyPuppetCommand,projectPuppet} from '../puppet/index.js';
import {hasPuppetLifeLock,syncPuppetMoon} from '../puppet/life.js';
import {hasPuppetEncounterLock,settlePuppetEncounter} from '../puppet/encounter.js';
import {projectPuppetCombat} from '../puppet/combat.js';
import {createDevilState,applyDevilCommand,projectDevil} from '../devil/index.js';
import {hasDevilLifeLock} from '../devil/life.js';
import {hasDevilEncounterLock,settleDevilEncounter} from '../devil/encounter.js';
import {projectDevilCombat} from '../devil/combat.js';
import {createBlackKnightState,applyBlackKnightCommand,projectBlackKnight} from '../black-knight/index.js';
import {hasBlackKnightLifeLock} from '../black-knight/life.js';
import {hasBlackKnightEncounterLock,settleBlackKnightEncounter} from '../black-knight/encounter.js';
import {projectBlackKnightCombat} from '../black-knight/combat.js';
import {createMysticState,applyMysticCommand,projectMystic} from '../mystic/index.js';
import {hasMysticLifeLock} from '../mystic/life.js';
import {hasMysticRitualLock} from '../mystic/ritual.js';
import {hasMysticEncounterLock,settleMysticEncounter} from '../mystic/encounter.js';
import {projectMysticCombat} from '../mystic/combat.js';
import {createDespairState,applyDespairCommand,projectDespair} from '../despair/index.js';
import {hasDespairLifeLock} from '../despair/life.js';
import {hasDespairEncounterLock,settleDespairEncounter} from '../despair/encounter.js';
import {projectDespairCombat} from '../despair/combat.js';
import {createDemonHunterState,applyDemonHunterCommand,projectDemonHunter} from '../demon-hunter/index.js';
import {hasDemonHunterLifeLock} from '../demon-hunter/life.js';
import {hasDemonHunterEncounterLock,settleDemonHunterEncounter} from '../demon-hunter/encounter.js';
import {projectDemonHunterCombat} from '../demon-hunter/combat.js';
import {createParasiteState,applyParasiteCommand,projectParasite} from '../parasite/index.js';
import {hasParasiteLifeLock} from '../parasite/life.js';
import {hasParasiteEncounterLock,settleParasiteEncounter} from '../parasite/encounter.js';
import {projectParasiteCombat} from '../parasite/combat.js';
import {createSecretsSorcererState,applySecretsSorcererCommand,projectSecretsSorcerer} from '../secrets-sorcerer/index.js';
import {hasSecretsSorcererLifeLock} from '../secrets-sorcerer/life.js';
import {hasSecretsSorcererRitualLock,settleSecretsSorcererRitual} from '../secrets-sorcerer/ritual.js';
import {projectSecretsSorcererCombat} from '../secrets-sorcerer/combat.js';
import {projectUndyingCombat} from '../undying/combat.js';
import {createUndyingState,applyUndyingCommand,projectUndying} from '../undying/index.js';
import {isUndyingActivityCommand,applyUndyingActivity,undyingInside} from '../undying/life.js';
import {hasUndyingRitualLock} from '../undying/ritual.js';
import {settleUndyingEncounter,isInsideUndyingEncounter} from '../undying/encounter.js';
import {projectUnshadowedCombat} from '../unshadowed/combat.js';
import {createUnshadowedState,applyUnshadowedCommand,projectUnshadowed} from '../unshadowed/index.js';
import {isUnshadowedActivityCommand,applyUnshadowedActivity,unshadowedInside} from '../unshadowed/life.js';
import {hasUnshadowedRitualLock} from '../unshadowed/ritual.js';
import {settleUnshadowedEncounter,isInsideUnshadowedEncounter} from '../unshadowed/encounter.js';
import {projectCataclysmPriestCombat} from '../cataclysm-priest/combat.js';
import {createCataclysmPriestState,applyCataclysmPriestCommand,projectCataclysmPriest} from '../cataclysm-priest/index.js';
import {isCataclysmPriestActivityCommand,applyCataclysmPriestActivity,cataclysmPriestInside} from '../cataclysm-priest/life.js';
import {hasCataclysmPriestRitualLock} from '../cataclysm-priest/ritual.js';
import {settleCataclysmPriestEncounter,isInsideCataclysmPriestEncounter} from '../cataclysm-priest/encounter.js';
import {projectProphetCombat} from '../prophet/combat.js';
import {createProphetState,applyProphetCommand,projectProphet} from '../prophet/index.js';
import {isProphetActivityCommand,applyProphetActivity,prophetInside} from '../prophet/life.js';
import {hasProphetRitualLock} from '../prophet/ritual.js';
import {settleProphetEncounter,isInsideProphetEncounter} from '../prophet/encounter.js';
import {createNightwatcherState,applyNightwatcherCommand,projectNightwatcher} from '../nightwatcher/index.js';
import {isNightwatcherActivityCommand,applyNightwatcherActivity,nightwatcherInside,nightwatcherOwnsOriginalLeafDeployment} from '../nightwatcher/life.js';
import {hasNightwatcherRitualLock} from '../nightwatcher/ritual.js';
import {settleNightwatcherEncounter,isInsideNightwatcherEncounter} from '../nightwatcher/encounter.js';
import {projectNightwatcherCombat} from '../nightwatcher/combat.js';
import {projectWitchKingCombat} from '../witch-king/combat.js';
import {createWitchKingState,applyWitchKingCommand,projectWitchKing} from '../witch-king/index.js';
import {isWitchKingActivity,applyWitchKingActivity,witchKingInside} from '../witch-king/life.js';
import {hasWitchKingRitualLock} from '../witch-king/ritual.js';
import {settleWitchKingEncounter,isInsideWitchKingEncounter} from '../witch-king/encounter.js';
import {createAlchemistState,applyAlchemistCommand,projectAlchemist} from '../alchemist/index.js';
import {isAlchemistActivity,applyAlchemistActivity,alchemistInside} from '../alchemist/life.js';
import {hasAlchemistRitualLock} from '../alchemist/ritual.js';
import {settleAlchemistEncounter,isInsideAlchemistEncounter} from '../alchemist/encounter.js';
import {projectManipulatorCombat} from '../manipulator/combat.js';
import {createManipulatorState,applyManipulatorCommand,projectManipulator} from '../manipulator/index.js';
import {isManipulatorActivity,applyManipulatorActivity,manipulatorInside} from '../manipulator/life.js';
import {hasManipulatorRitualLock} from '../manipulator/ritual.js';
import {settleManipulatorEncounter,isInsideManipulatorEncounter} from '../manipulator/encounter.js';
import {createIronBloodKnightState,applyIronBloodKnightCommand,projectIronBloodKnight} from '../iron-blood-knight/index.js';
import {isIronBloodActivity,applyIronBloodActivity,ironBloodInside} from '../iron-blood-knight/life.js';
import {hasIronBloodRitualLock} from '../iron-blood-knight/team.js';
import {settleIronBloodEncounter,isInsideIronBloodEncounter} from '../iron-blood-knight/encounter.js';
import {projectIronBloodCombat} from '../iron-blood-knight/combat.js';
import {createBizarroSorcererState,applyBizarroSorcererCommand,projectBizarroSorcerer} from '../bizarro-sorcerer/index.js';
import {isBizarroActivity,applyBizarroActivity,bizarroInside} from '../bizarro-sorcerer/life.js';
import {hasBizarroRitualLock,settleBizarroRitual} from '../bizarro-sorcerer/ritual.js';
import {projectBizarroCombat,BIZARRO_ENEMY_COUNT_WHEEL,BIZARRO_ENEMY_ABILITY_WHEEL} from '../bizarro-sorcerer/ritual-combat.js';
import {createDruidState,applyDruidCommand,projectDruid} from '../druid/index.js';
import {isDruidActivity,applyDruidActivity,druidActions,druidCases,druidPractice,druidInside,DRUID_ENVIRONMENT} from '../druid/life.js';
import {settleDruidEncounter} from '../druid/encounter.js';
import {createPunishmentKnightState,applyPunishmentKnightCommand,projectPunishmentKnight} from '../punishment-knight/index.js';
import {isPunishmentKnightActivity,applyPunishmentKnightActivity,punishmentKnightActions,punishmentKnightCases,punishmentKnightPractice,punishmentKnightInside,PUNISHMENT_KNIGHT_ENVIRONMENT} from '../punishment-knight/life.js';
import {settlePunishmentKnightEncounter} from '../punishment-knight/encounter.js';
import {createMentorDisorderState,applyMentorDisorderCommand,projectMentorDisorder} from '../mentor-disorder/index.js';
import {isMentorDisorderActivity,applyMentorDisorderActivity,mentorDisorderActions,mentorDisorderCases,mentorDisorderPractice,mentorDisorderInside,MENTOR_DISORDER_ENVIRONMENT} from '../mentor-disorder/life.js';
import {settleMentorDisorderEncounter} from '../mentor-disorder/encounter.js';
import {createWinnerState,applyWinnerCommand,projectWinner} from '../winner/index.js';
import {isWinnerActivity,applyWinnerActivity,winnerActions,winnerCases,winnerPractice,winnerInside,WINNER_ENVIRONMENT} from '../winner/life.js';
import {settleWinnerEncounter} from '../winner/encounter.js';
import {createWraithState,applyWraithCommand,projectWraith} from '../wraith/index.js';
import {isWraithActivity,applyWraithActivity,wraithActions,wraithCases,wraithPractice,wraithInside,syncWraithMoon,WRAITH_ENVIRONMENT} from '../wraith/life.js';
import {settleWraithEncounter} from '../wraith/encounter.js';
import {createDesireApostleState,applyDesireApostleCommand,projectDesireApostle} from '../desire-apostle/index.js';
import {isDesireApostleActivity,applyDesireApostleActivity,desireApostleActions,desireApostleCases,desireApostlePractice,desireApostleInside,DESIRE_APOSTLE_ENVIRONMENT} from '../desire-apostle/life.js';
import {settleDesireApostleEncounter} from '../desire-apostle/encounter.js';
import {createShepherdState,applyShepherdCommand,projectShepherd} from '../shepherd/index.js';
import {isShepherdActivity,applyShepherdActivity,shepherdActions,shepherdCases,shepherdPractice,shepherdGrazing,activateShepherdSpirit,shepherdInside,SHEPHERD_ENVIRONMENT} from '../shepherd/life.js';
import {settleShepherdEncounter} from '../shepherd/encounter.js';
import {createStarMysticState,applyStarMysticCommand,projectStarMystic} from '../star-mystic/index.js';
import {isStarMysticActivity,applyStarMysticActivity,starMysticActions,starMysticCases,starMysticPractice,starMysticInside,STAR_MYSTIC_ENVIRONMENT} from '../star-mystic/life.js';
import {settleStarMysticEncounter} from '../star-mystic/encounter.js';
import {createPainState,applyPainCommand,projectPain} from '../pain/index.js';
import {isPainActivity,applyPainActivity,painActions,painCases,painPractice,painInside,PAIN_ENVIRONMENT} from '../pain/life.js';
import {settlePainEncounter} from '../pain/encounter.js';
import {createGuardianState,applyGuardianCommand,projectGuardian} from '../guardian/index.js';
import {isGuardianActivity,applyGuardianActivity,guardianActions,guardianCases,guardianPractice,guardianInside,GUARDIAN_ENVIRONMENT} from '../guardian/life.js';
import {settleGuardianEncounter} from '../guardian/encounter.js';
import {createDreamStealerState,applyDreamStealerCommand,projectDreamStealer} from '../dream-stealer/index.js';
import {isDreamStealerActivity,applyDreamStealerActivity,dreamStealerActions,dreamStealerCases,dreamStealerPractice,dreamStealerInside,DREAM_STEALER_ENVIRONMENT} from '../dream-stealer/life.js';
import {settleDreamStealerEncounter} from '../dream-stealer/encounter.js';
import {createTravelerState,applyTravelerCommand,projectTraveler} from '../traveler/index.js';
import {isTravelerActivity,applyTravelerActivity,travelerActions,travelerCases,travelerPractice,travelerInside,TRAVELER_ENVIRONMENT} from '../traveler/life.js';
import {settleTravelerEncounter} from '../traveler/encounter.js';
import {createGatekeeperState,applyGatekeeperCommand,projectGatekeeper} from '../gatekeeper/index.js';
import {isGatekeeperActivity,applyGatekeeperActivity,gatekeeperActions,gatekeeperCases,gatekeeperCompanion,gatekeeperPractice,gatekeeperInside,GATEKEEPER_ENVIRONMENT} from '../gatekeeper/life.js';
import {settleGatekeeperEncounter} from '../gatekeeper/encounter.js';
import {createPriestOfLightState,applyPriestOfLightCommand,projectPriestOfLight} from '../priest-of-light/index.js';
import {isPriestOfLightActivity,applyPriestOfLightActivity,priestOfLightActions,priestOfLightCases,priestOfLightPractice,priestOfLightInside,PRIEST_OF_LIGHT_ENVIRONMENT} from '../priest-of-light/life.js';
import {settlePriestOfLightEncounter} from '../priest-of-light/encounter.js';
import {createOceanSingerState,applyOceanSingerCommand,projectOceanSinger} from '../ocean-singer/index.js';
import {isOceanSingerActivity,applyOceanSingerActivity,oceanSingerActions,oceanSingerCases,oceanSingerPractice,oceanSingerInside,OCEAN_SINGER_ENVIRONMENT} from '../ocean-singer/life.js';
import {settleOceanSingerEncounter} from '../ocean-singer/encounter.js';
import {createMysticismMagisterState,applyMysticismMagisterCommand,projectMysticismMagister} from '../mysticism-magister/index.js';
import {isMysticismMagisterActivity,applyMysticismMagisterActivity,mysticismMagisterActions,mysticismMagisterCases,mysticismMagisterInside,mysticismMagisterPractice,mysticismMagisterCrafts,MYSTICISM_MAGISTER_ENVIRONMENT} from '../mysticism-magister/life.js';
import {settleMysticismMagisterEncounter} from '../mysticism-magister/encounter.js';
import {createSpiritWarlockState,applySpiritWarlockCommand,projectSpiritWarlock} from '../spirit-warlock/index.js';
import {isSpiritWarlockActivity,applySpiritWarlockActivity,spiritWarlockActions,spiritWarlockCases,spiritWarlockInside,spiritWarlockCompanion,spiritWarlockPractice,SPIRIT_WARLOCK_ENVIRONMENT} from '../spirit-warlock/life.js';
import {settleSpiritWarlockEncounter} from '../spirit-warlock/encounter.js';
import {createCrimsonScholarState,applyCrimsonScholarCommand,projectCrimsonScholar} from '../crimson-scholar/index.js';
import {isCrimsonScholarActivity,applyCrimsonScholarActivity,crimsonScholarActions,crimsonScholarCases,crimsonScholarInside,CRIMSON_SCHOLAR_ENVIRONMENT} from '../crimson-scholar/life.js';
import {settleCrimsonScholarEncounter} from '../crimson-scholar/encounter.js';
import {createAstronomerState,applyAstronomerCommand,projectAstronomer} from '../astronomer/index.js';
import {isAstronomerActivity,applyAstronomerActivity,astronomerActions,astronomerCases,astronomerInside,ASTRONOMER_ENVIRONMENT} from '../astronomer/life.js';
import {settleAstronomerEncounter} from '../astronomer/encounter.js';
import {createDreamwalkerState,applyDreamwalkerCommand,projectDreamwalker} from '../dreamwalker/index.js';
import {isDreamwalkerActivity,applyDreamwalkerActivity,dreamwalkerActions,dreamwalkerCases,dreamwalkerInside,DREAMWALKER_ENVIRONMENT} from '../dreamwalker/life.js';
import {settleDreamwalkerEncounter} from '../dreamwalker/encounter.js';
import {createReaperState,applyReaperCommand,projectReaper} from '../reaper/index.js';
import {isReaperActivity,applyReaperActivity,reaperActions,reaperCases,reaperInside,REAPER_ENVIRONMENT} from '../reaper/life.js';
import {settleReaperEncounter} from '../reaper/encounter.js';
import {createMarionettistState,applyMarionettistAcquisition,applyMarionettistActivity,isMarionettistAcquisitionCommand,projectMarionettist,marionettistInside} from '../marionettist/index.js';
import {settleMarionettistEncounter} from '../marionettist/encounter.js';
import {createBiologistState,applyBiologistCommand,projectBiologist} from '../biologist/index.js';
import {isBiologistActivity,applyBiologistActivity,biologistActions,biologistCases,biologistInside,BIOLOGIST_ENVIRONMENT} from '../biologist/life.js';
import {settleBiologistEncounter} from '../biologist/encounter.js';
import {createJudgeState,applyJudgeCommand,projectJudge} from '../judge/index.js';
import {isJudgeActivity,applyJudgeActivity,judgeActions,judgeCases,judgeInside,JUDGE_ENVIRONMENT} from '../judge/life.js';
import {settleJudgeEncounter} from '../judge/encounter.js';
import {createCorruptionBaronState,applyCorruptionBaronCommand,projectCorruptionBaron} from '../corruption-baron/index.js';
import {isCorruptionBaronActivity,applyCorruptionBaronActivity,corruptionBaronActions,corruptionBaronCases,corruptionBaronInside,CORRUPTION_BARON_ENVIRONMENT} from '../corruption-baron/life.js';
import {settleCorruptionBaronEncounter} from '../corruption-baron/encounter.js';
import {createCalamityPriestState,applyCalamityPriestCommand,projectCalamityPriest} from '../calamity-priest/index.js';
import {isCalamityPriestActivity,applyCalamityPriestActivity,calamityPriestActions,calamityPriestCases,calamityPriestInside,CALAMITY_PRIEST_ENVIRONMENT} from '../calamity-priest/life.js';
import {settleCalamityPriestEncounter} from '../calamity-priest/encounter.js';
import {createZombieState,applyZombieCommand,projectZombie} from '../zombie/index.js';
import {isZombieActivity,applyZombieActivity,zombieActions,zombieCases,zombieInside,syncZombieMoon,ZOMBIE_ENVIRONMENT} from '../zombie/life.js';
import {settleZombieEncounter} from '../zombie/encounter.js';
import {createDemonState,applyDemonCommand,projectDemon} from '../demon/index.js';
import {isDemonActivity,applyDemonActivity,demonActions,demonCases,demonInside,DEMON_ENVIRONMENT} from '../demon/life.js';
import {settleDemonEncounter} from '../demon/encounter.js';
import {createRoseBishopState,applyRoseBishopCommand,projectRoseBishop} from '../rose-bishop/index.js';
import {isRoseBishopActivity,applyRoseBishopActivity,roseBishopActions,roseBishopCases,roseBishopInside,ROSE_BISHOP_ENVIRONMENT} from '../rose-bishop/life.js';
import {settleRoseBishopEncounter} from '../rose-bishop/encounter.js';
import {createScrollProfessorState,applyScrollProfessorCommand,projectScrollProfessor} from '../scroll-professor/index.js';
import {isScrollProfessorActivity,applyScrollProfessorActivity,scrollProfessorActions,scrollProfessorCases,scrollProfessorInside,SCROLL_PROFESSOR_ENVIRONMENT} from '../scroll-professor/life.js';
import {settleScrollProfessorEncounter} from '../scroll-professor/encounter.js';
import {createPleasureState,applyPleasureCommand,projectPleasure} from '../pleasure/index.js';
import {isPleasureActivity,applyPleasureActivity,pleasureActions,pleasureCases,pleasureInside,PLEASURE_ENVIRONMENT} from '../pleasure/life.js';
import {settlePleasureEncounter} from '../pleasure/encounter.js';
import {createDawnPaladinState,applyDawnPaladinCommand,projectDawnPaladin} from '../dawn-paladin/index.js';
import {isDawnPaladinActivity,applyDawnPaladinActivity,dawnPaladinActions,dawnPaladinCases,dawnPaladinInside,DAWN_PALADIN_ENVIRONMENT} from '../dawn-paladin/life.js';
import {settleDawnPaladinEncounter} from '../dawn-paladin/encounter.js';
import {BARD_COUNT_WHEEL,bardAbilityWheel} from '../bard/combat.js';
import {createFireThiefState,applyFireThiefCommand,projectFireThief} from '../fire-thief/index.js';
import {isFireThiefActivity,applyFireThiefActivity,fireThiefActions,fireThiefCases,fireThiefInside,FIRE_THIEF_ENVIRONMENT} from '../fire-thief/life.js';
import {settleFireThiefEncounter} from '../fire-thief/encounter.js';
import {createRecorderState,applyRecorderCommand,projectRecorder} from '../recorder/index.js';
import {isRecorderActivity,applyRecorderActivity,recorderActions,recorderCases,recorderInside,RECORDER_ENVIRONMENT} from '../recorder/life.js';
import {settleRecorderEncounter} from '../recorder/encounter.js';
import {createSpiritGuideState,applySpiritGuideCommand,projectSpiritGuide} from '../spirit-guide/index.js';
import {isSpiritGuideActivity,applySpiritGuideActivity,spiritGuideActions,spiritGuideCases,spiritGuideInside,SPIRIT_GUIDE_ENVIRONMENT} from '../spirit-guide/life.js';
import {settleSpiritGuideEncounter} from '../spirit-guide/encounter.js';
import {createNotaryState,applyNotaryCommand,projectNotary} from '../notary/index.js';
import {isNotaryActivity,applyNotaryActivity,notaryActions,notaryCases,notaryInside,NOTARY_ENVIRONMENT} from '../notary/life.js';
import {settleNotaryEncounter} from '../notary/encounter.js';
import {createWindBlessedState,applyWindBlessedCommand,projectWindBlessed} from '../wind-blessed/index.js';
import {isWindBlessedActivity,applyWindBlessedActivity,windBlessedActions,windBlessedCases,windBlessedInside,WIND_BLESSED_ENVIRONMENT} from '../wind-blessed/life.js';
import {settleWindBlessedEncounter} from '../wind-blessed/encounter.js';
import {createPolymathState,applyPolymathCommand,projectPolymath} from '../polymath/index.js';
import {isPolymathActivity,applyPolymathActivity,polymathActions,polymathCases,polymathInside,POLYMATH_ENVIRONMENT} from '../polymath/life.js';
import {settlePolymathEncounter} from '../polymath/encounter.js';
import {createSootherState,applySootherCommand,projectSoother} from '../soother/index.js';
import {isSootherActivity,applySootherActivity,sootherActions,sootherCases,sootherInside,SOOTHER_ENVIRONMENT} from '../soother/life.js';
import {settleSootherEncounter} from '../soother/encounter.js';
import {createPotionProfessorState,applyPotionProfessorCommand,projectPotionProfessor} from '../potion-professor/index.js';
import {isPotionProfessorActivity,applyPotionProfessorActivity,potionProfessorActions,potionProfessorCases,potionProfessorInside,POTION_PROFESSOR_ENVIRONMENT} from '../potion-professor/life.js';
import {settlePotionProfessorEncounter} from '../potion-professor/encounter.js';
import {createArtisanState,applyArtisanCommand,projectArtisan} from '../artisan/index.js';
import {isArtisanActivity,applyArtisanActivity,artisanActions,artisanCases,artisanInside,ARTISAN_ENVIRONMENT} from '../artisan/life.js';
import {settleArtisanEncounter} from '../artisan/encounter.js';
import {createHypnotistState,applyHypnotistCommand,projectHypnotist} from '../hypnotist/index.js';
import {isHypnotistActivity,applyHypnotistActivity,hypnotistActions,hypnotistCases,hypnotistInside,HYPNOTIST_ENVIRONMENT} from '../hypnotist/life.js';
import {settleHypnotistEncounter} from '../hypnotist/encounter.js';
import {createConspiratorState,applyConspiratorCommand,projectConspirator} from '../conspirator/index.js';
import {isConspiratorActivity,applyConspiratorActivity,conspiratorActions,conspiratorCases,conspiratorInside,CONSPIRATOR_ENVIRONMENT} from '../conspirator/life.js';
import {settleConspiratorEncounter} from '../conspirator/encounter.js';
import {settleFacelessEncounter} from '../faceless/encounter.js';
import {createFacelessState,applyFacelessAcquisition,projectFaceless,isFacelessAcquisitionCommand} from '../faceless/index.js';
import {applyFacelessActivity,facelessInside} from '../faceless/practice.js';
import {PHYSICIAN_ABILITIES} from '../physician/content.js';
import {createHarvestpriestState,applyHarvestpriestCommand,projectHarvestpriest} from '../harvestpriest/index.js';
import {isHarvestpriestActivity,applyHarvestpriestActivity,harvestpriestActions,harvestpriestCases,harvestpriestInside,harvestpriestPlot,HARVESTPRIEST_ENVIRONMENT} from '../harvestpriest/life.js';
import {CULTIVATOR_ABILITIES} from '../cultivator/content.js';
import {createPhysicianState,applyPhysicianCommand,projectPhysician} from '../physician/index.js';
import {isPhysicianActivity,applyPhysicianActivity,physicianActions,physicianCases,physicianInside,physicianClinic,PHYSICIAN_ENVIRONMENT} from '../physician/life.js';
import {createCultivatorState,applyCultivatorCommand,projectCultivator} from '../cultivator/index.js';
import {isCultivatorActivity,applyCultivatorActivity,cultivatorActions,cultivatorCases,cultivatorInside,cultivatorGarden,CULTIVATOR_ENVIRONMENT} from '../cultivator/life.js';
import {SHERIFF_ABILITIES} from '../sheriff/content.js';
import {createInterrogatorState,applyInterrogatorCommand,projectInterrogator} from '../interrogator/index.js';
import {isInterrogatorActivity,applyInterrogatorActivity,interrogatorActions,interrogatorCases,interrogatorInside,INTERROGATOR_ENVIRONMENT} from '../interrogator/life.js';
import {ARBITER_ABILITIES} from '../arbiter/content.js';
import {createSheriffState,applySheriffCommand,projectSheriff} from '../sheriff/index.js';
import {isSheriffActivity,applySheriffActivity,sheriffActions,sheriffCases,sheriffInside,SHERIFF_ENVIRONMENT} from '../sheriff/life.js';
import {createArbiterState,applyArbiterCommand,projectArbiter} from '../arbiter/index.js';
import {isArbiterActivity,applyArbiterActivity,arbiterActions,arbiterCases,arbiterInside,ARBITER_ENVIRONMENT} from '../arbiter/life.js';
import {createBriberState,applyBriberCommand,projectBriber} from '../briber/index.js';
import {isBriberActivity,applyBriberActivity,briberActions,briberCases,briberInside,BRIBER_ENVIRONMENT} from '../briber/life.js';
import {createBarbarianState,applyBarbarianCommand,projectBarbarian} from '../barbarian/index.js';
import {isBarbarianActivity,applyBarbarianActivity,barbarianActions,barbarianCases,barbarianInside,BARBARIAN_ENVIRONMENT} from '../barbarian/life.js';
import {createLawyerState,applyLawyerCommand,projectLawyer} from '../lawyer/index.js';
import {isLawyerActivity,applyLawyerActivity,lawyerActions,lawyerCases,lawyerInside,LAWYER_ENVIRONMENT} from '../lawyer/life.js';
import {createLuckyState,applyLuckyCommand,projectLucky} from '../lucky/index.js';
import {isLuckyActivity,applyLuckyActivity,luckyActions,luckyCases,luckyInside,LUCKY_ENVIRONMENT} from '../lucky/life.js';
import {createMachineState,applyMachineCommand,projectMachine} from '../machine/index.js';
import {isMachineActivity,applyMachineActivity,machineActions,machineCases,machineInside,MACHINE_ENVIRONMENT} from '../machine/life.js';
import {createMonsterState,applyMonsterCommand,projectMonster} from '../monster/index.js';
import {isMonsterActivity,applyMonsterActivity,monsterActions,monsterCases,monsterInside,MONSTER_ENVIRONMENT} from '../monster/life.js';
import {createWerewolfState,applyWerewolfCommand,projectWerewolf} from '../werewolf/index.js';
import {isWerewolfActivity,applyWerewolfActivity,werewolfActions,werewolfCases,werewolfInside,syncWerewolfMoon,WEREWOLF_ENVIRONMENT} from '../werewolf/life.js';
import {createMadmanState,applyMadmanCommand,projectMadman} from '../madman/index.js';
import {isMadmanActivity,applyMadmanActivity,madmanActions,madmanCases,madmanInside,MADMAN_ENVIRONMENT} from '../madman/life.js';
import {createPrisonerState,applyPrisonerCommand,projectPrisoner} from '../prisoner/index.js';
import {isPrisonerActivity,applyPrisonerActivity,prisonerActions,prisonerCases,prisonerInside,PRISONER_ENVIRONMENT} from '../prisoner/life.js';
import {createSerialKillerState,applySerialKillerCommand,projectSerialKiller} from '../serial-killer/index.js';
import {isSerialKillerActivity,applySerialKillerActivity,serialKillerActions,serialKillerCases,serialKillerInside,SERIAL_KILLER_ENVIRONMENT} from '../serial-killer/life.js';
import {createUnwingedState,applyUnwingedCommand,projectUnwinged} from '../unwinged/index.js';
import {isUnwingedActivity,applyUnwingedActivity,unwingedActions,unwingedCases,unwingedInside,UNWINGED_ENVIRONMENT} from '../unwinged/life.js';
import {createCriminalState,applyCriminalCommand,projectCriminal} from '../criminal/index.js';
import {isCriminalActivity,applyCriminalActivity,criminalActions,criminalCases,criminalInside,CRIMINAL_ENVIRONMENT} from '../criminal/life.js';
import {createShadowAsceticState,applyShadowAsceticCommand,projectShadowAscetic} from '../shadow-ascetic/index.js';
import {isShadowAsceticActivity,applyShadowAsceticActivity,shadowAsceticActions,shadowAsceticCases,shadowAsceticInside,SHADOW_ASCETIC_ENVIRONMENT} from '../shadow-ascetic/life.js';
import {createListenerState,applyListenerCommand,projectListener} from '../listener/index.js';
import {isListenerActivity,applyListenerActivity,listenerActions,listenerCases,listenerInside,LISTENER_ENVIRONMENT} from '../listener/life.js';
import {createSecretSupplicantState,applySecretSupplicantCommand,projectSecretSupplicant} from '../secret-supplicant/index.js';
import {isSecretSupplicantActivity,applySecretSupplicantActivity,secretSupplicantActions,secretSupplicantCases,secretSupplicantInside,SECRET_SUPPLICANT_ENVIRONMENT} from '../secret-supplicant/life.js';
import {createWizardState,applyWizardCommand,projectWizard} from '../wizard/index.js';
import {isWizardActivity,applyWizardActivity,wizardActions,wizardCases,wizardLessons,wizardInside,WIZARD_ENVIRONMENT} from '../wizard/life.js';
import {createCombatScholarState,applyCombatScholarCommand,projectCombatScholar} from '../combat-scholar/index.js';
import {isCombatScholarActivity,applyCombatScholarActivity,combatScholarActions,combatScholarCases,combatScholarInside,COMBAT_SCHOLAR_ENVIRONMENT} from '../combat-scholar/life.js';
import {createPryerState,applyPryerCommand,projectPryer} from '../pryer/index.js';
import {isPryerActivity,applyPryerActivity,pryerActions,pryerCases,pryerInside,PRYER_ENVIRONMENT} from '../pryer/life.js';
import {createWitchState,applyWitchCommand,projectWitch} from '../witch/index.js';
import {isWitchActivity,applyWitchActivity,witchActions,witchCases,WITCH_ENVIRONMENT} from '../witch/life.js';
import {createInstigatorState,applyInstigatorCommand,projectInstigator} from '../instigator/index.js';
import {isInstigatorActivity,applyInstigatorActivity,instigatorActions,instigatorCases,instigatorInside,INSTIGATOR_ENVIRONMENT} from '../instigator/life.js';
import {createAssassinState,applyAssassinCommand,projectAssassin} from '../assassin/index.js';
import {isAssassinActivity,applyAssassinActivity,assassinActions,assassinCases,assassinInside,assassinDraft,ASSASSIN_ENVIRONMENT} from '../assassin/life.js';
import {createWeaponmasterState,applyWeaponmasterCommand,projectWeaponmaster} from '../weaponmaster/index.js';
import {isWeaponmasterActivity,applyWeaponmasterActivity,weaponmasterActions,weaponmasterCases,WEAPONMASTER_ENVIRONMENT} from '../weaponmaster/life.js';
import {createGladiatorState,applyGladiatorCommand,projectGladiator} from '../gladiator/index.js';
import {isGladiatorActivity,applyGladiatorActivity,gladiatorActions,gladiatorCases,gladiatorInside,GLADIATOR_ENVIRONMENT} from '../gladiator/life.js';
import {createWarriorState,applyWarriorCommand,projectWarrior} from '../warrior/index.js';
import {isWarriorActivity,applyWarriorActivity,warriorActions,warriorCases,warriorTool,WARRIOR_ENVIRONMENT} from '../warrior/life.js';
import {createCryptologistState,applyCryptologistCommand,projectCryptologist} from '../cryptologist/index.js';
import {isCryptologistActivity,applyCryptologistActivity,cryptologistActions,cryptologistCases,CRYPTOLOGIST_ENVIRONMENT} from '../cryptologist/life.js';
import {createSwindlerState,applySwindlerCommand,projectSwindler} from '../swindler/index.js';
import {isSwindlerActivity,applySwindlerActivity,swindlerActions,swindlerCases,SWINDLER_ENVIRONMENT} from '../swindler/life.js';
import {isMarauderDisputeCommand,applyMarauderDispute,marauderDisputeActions,settleMarauderDispute} from '../marauder/dispute.js';
import {marauderEnemyArmed} from '../marauder/combat.js';
import {createMarauderState,applyMarauderCommand,projectMarauder} from '../marauder/index.js';
import {isMarauderActivity,applyMarauderActivity,marauderActions,marauderCases,marauderOriginals,MARAUDER_ENVIRONMENT} from '../marauder/life.js';
import {createAstrologerState,applyAstrologerCommand,projectAstrologer} from '../astrologer/index.js';
import {isAstrologerActivity,applyAstrologerActivity,astrologerActions,astrologerCases,ASTROLOGER_ENVIRONMENT} from '../astrologer/life.js';
import {createTrickmasterState,applyTrickmasterCommand,projectTrickmaster} from '../trickmaster/index.js';
import {isTrickmasterActivity,applyTrickmasterActivity,trickmasterActions,trickmasterCases,TRICKMASTER_ENVIRONMENT} from '../trickmaster/life.js';
import {createApprenticeState,applyApprenticeCommand,projectApprentice} from '../apprentice/index.js';
import {isApprenticeActivity,applyApprenticeActivity,apprenticeActions,apprenticeCases,apprenticeInside,APPRENTICE_ENVIRONMENT} from '../apprentice/life.js';
import {createSpiritmediumState,applySpiritmediumCommand,projectSpiritmedium} from '../spiritmedium/index.js';
import {isSpiritmediumActivity,applySpiritmediumActivity,spiritmediumActions,spiritmediumCases,SPIRITMEDIUM_ENVIRONMENT} from '../spiritmedium/life.js';
import {createGravediggerState,applyGravediggerCommand,projectGravedigger} from '../gravedigger/index.js';
import {isGravediggerActivity,applyGravediggerActivity,gravediggerActions,gravediggerCases,GRAVEDIGGER_ENVIRONMENT} from '../gravedigger/life.js';
import {createCorpsecollectorState,applyCorpsecollectorCommand,projectCorpsecollector} from '../corpsecollector/index.js';
import {isCorpsecollectorActivity,applyCorpsecollectorActivity,corpsecollectorActions,corpsecollectorCases,CORPSECOLLECTOR_ENVIRONMENT} from '../corpsecollector/life.js';
import {createSunpriestState,applySunpriestCommand,projectSunpriest} from '../sunpriest/index.js';
import {isSunpriestActivity,applySunpriestActivity,sunpriestActions,sunpriestCases,SUNPRIEST_ENVIRONMENT} from '../sunpriest/life.js';
import {createLightprayerState,applyLightprayerCommand,projectLightprayer} from '../lightprayer/index.js';
import {isLightprayerActivity,applyLightprayerActivity,lightprayerActions,lightprayerCases,LIGHTPRAYER_ENVIRONMENT} from '../lightprayer/life.js';
import {createBardState,applyBardCommand,projectBard} from '../bard/index.js';
import {isBardActivity,applyBardActivity,bardActions,bardCases,BARD_ENVIRONMENT} from '../bard/life.js';
import {createNavigatorState,applyNavigatorCommand,projectNavigator} from '../navigator/index.js';
import {isNavigatorActivity,applyNavigatorActivity,navigatorActions,navigatorCases,NAVIGATOR_ENVIRONMENT} from '../navigator/life.js';
import {createRagerState,applyRagerCommand,projectRager} from '../rager/index.js';
import {isRagerActivity,applyRagerActivity,ragerActions,ragerCases,RAGER_ENVIRONMENT} from '../rager/life.js';
import {createSailorState,applySailorCommand,projectSailor} from '../sailor/index.js';
import {isSailorActivity,applySailorActivity,sailorActions,sailorCases,SAILOR_ENVIRONMENT} from '../sailor/life.js';
import {createDetectiveState,applyDetectiveCommand,projectDetective} from '../detective/index.js';
import {isDetectiveActivity,applyDetectiveActivity,detectiveActions,detectiveCases,DETECTIVE_ENVIRONMENT} from '../detective/life.js';
import {createReasonerState,applyReasonerCommand,projectReasoner} from '../reasoner/index.js';
import {isReasonerActivity,applyReasonerActivity,reasonerActions,reasonerCases,REASONER_ENVIRONMENT} from '../reasoner/life.js';
import {createReaderState,applyReaderCommand,projectReader} from '../reader/index.js';
import {isReaderActivity,applyReaderActivity,readerActions,readerCases,READER_ENVIRONMENT} from '../reader/life.js';
import {createNightmareState,applyNightmareCommand,projectNightmare} from '../nightmare/index.js';
import {isNightmareActivity,applyNightmareActivity,nightmareActions,nightmareCases,settleNightmareEncounter,NIGHTMARE_ENVIRONMENT} from '../nightmare/life.js';
import {createMidnightState,applyMidnightCommand,projectMidnight} from '../midnight/index.js';
import {isMidnightActivity,applyMidnightActivity,midnightActions,midnightCases,settleMidnightEncounter,MIDNIGHT_ENVIRONMENT} from '../midnight/life.js';
import {createSleeplessState,applySleeplessCommand,projectSleepless} from '../sleepless/index.js';
import {isSleeplessActivity,applySleeplessWatch,sleeplessActions,sleeplessWatches,settleSleeplessEncounter,SLEEPLESS_ENVIRONMENT} from '../sleepless/watch.js';
import {createVampireState,applyVampireCommand,projectVampire} from '../vampire/index.js';
import {isVampireActivity,applyVampireLife,vampireActions,vampirePractices,vampireBloodSummary,settleVampireEncounter,VAMPIRE_ENVIRONMENT} from '../vampire/life.js';
import {createAppraiserState,applyAppraiserCommand,projectAppraiser} from '../appraiser/index.js';
import {isAppraiserActivity,applyAppraiserPractice,appraiserActions,appraiserItems,APPRAISER_ENVIRONMENT} from '../appraiser/appraisal.js';
import {createPsychologistState,applyPsychologistCommand,projectPsychologist} from '../psychologist/index.js';
import {isPsychologistActivity,applyPsychologistSocial,psychologistActions,psychologistScenes,settlePsychologistEncounter,PSYCHOLOGIST_ENVIRONMENT} from '../psychologist/social.js';
import {createPyromaniacState,applyPyromaniacCommand,projectPyromaniac} from '../pyromaniac/index.js';
import {isPyromaniacActivity,applyPyromaniacPractice,pyromaniacActions,pyromaniacPractices,pyromaniacEnvironment,settlePyromaniacEncounter} from '../pyromaniac/practice.js';
import {createMagicianState,applyMagicianCommand,projectMagician} from '../magician/index.js';
import {isMagicianActivity,applyMagicianPractice,magicianActions,magicianPractices,settleMagicianEncounter} from '../magician/practice.js';
import {createTamerState,applyTamerCommand,projectTamer} from '../tamer/index.js';
import {applyTamerAnimals,tamerActions,tamerAnimals,tamerCompanionName,isTamerAnimals} from '../tamer/animals.js';
import {createApothecaryState,applyApothecaryCommand,projectApothecary} from '../apothecary/index.js';
import {applyApothecaryClinic,apothecaryClinicActions,apothecaryCases,isApothecaryClinic} from '../apothecary/clinic.js';
import {createArchaeologistState,applyArchaeologistCommand,projectArchaeologist} from '../archaeologist/index.js';
import {applyArchaeologistExploration,archaeologistActions,archaeologistSites,isArchaeologistExploration} from '../archaeologist/exploration.js';
import {createSavantState,applySavantCommand,projectSavant} from '../savant/index.js';
import {applySavantCraft,savantCraftActions,savantProjects,isSavantCraft} from '../savant/craft.js';
import {appendPathwayItems} from '../town/carried.js';
import {createTownState,applyTownCommand,projectTown} from '../town/index.js';
import {createMindreaderState,applyMindreaderCommand,projectMindreader} from '../mindreader/index.js';
import {applyMindreaderSocial,mindreaderSocialActions,mindreaderScenes} from '../mindreader/social.js';
import {createAudienceState,applyAudienceCommand,projectAudience} from '../audience/index.js';
import {applyAudienceSocial,audienceSocialActions,audienceSocialScenes} from '../audience/social.js';
import {createProvokerState,applyProvokerCommand,projectProvoker} from '../provoker/index.js';
import {applyProvokerAdventure,provokerAdventureActions,provokerAdventureCases,settleProvokerEncounter,PROVOKER_STORY} from '../provoker/adventure.js';
import {createHunterState,applyHunterCommand,projectHunter} from '../hunter/index.js';
import {applyHunterAdventure,hunterAdventureActions,settleHunterCargo,HUNTER_CARGO_STORY} from '../hunter/adventure.js';
import {createClownState,applyClownCommand,projectClown} from '../clown/index.js';
import {applyClownAdventure,clownAdventureActions,settleClownRescue,CLOWN_RESCUE_STORY} from '../clown/adventure.js';
import {emptyProgression,createSeerState,applySeerCommand,projectSeer,awardSeerMastery} from '../seer/index.js';
import {playerAbilityWheel,playerCountWheel} from './combat.js';
import { computeSliceCreation, type SliceCreationSelection } from '../../content/slice-creation.js';
import { SLICE_LEARNING_TOPICS, SLICE_LIFE, SLICE_ORIGIN_EVENTS } from '../../content/slice-events.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { addGameWeeks } from '../game-calendar.js';
import type { PublicCoreStatKey } from '../../shared/contracts.js';
import { currentEvent, investigationTargets, learnTargets, nextStep } from './events.js';
import { consequenceWeights, ordinaryAbilityWheel, ORDINARY_COUNT_WHEEL, resolveSliceCombatRound } from './combat.js';
import type { AccountabilityOutcome, HazardOutcome, SliceEnding, SliceIntent, SliceProjection, SliceState, WorkersOutcome } from './types.js';
export * from './types.js';
export { assertValidSliceState, validateSlicePayload } from './validation.js';
export class SliceRuleError extends Error { constructor(message:string){super(message);this.name='SliceRuleError';} }
const requireRule=(ok:unknown,message:string):void=>{if(!ok)throw new SliceRuleError(message);};
const clone=<T>(v:T):T=>JSON.parse(JSON.stringify(v)) as T;
const publicLifeGiverPartner = (p: LifeGiverRoundOutcome['partnerAfter']): LifeGiverRoundOutcome['partnerAfter'] => ({
  id: p.id, name: p.name, source: p.source, adult: p.adult, independentMind: p.independentMind,
  bodyId: p.bodyId, homeId: p.homeId, location: p.location, health: p.health, mind: p.mind,
  stamina: p.stamina, status: p.status, willing: p.willing, metWeek: p.metWeek,
  ordinaryDistanceM: p.ordinaryDistanceM, gateCrossings: p.gateCrossings,
  chime: { id: p.chime.id, owner: p.chime.owner },
  restHistory: p.restHistory.map(r => ({
    week: r.week, paidPennies: r.paidPennies, staminaBefore: r.staminaBefore, staminaAfter: r.staminaAfter,
    mindBefore: r.mindBefore, mindAfter: r.mindAfter, healthUnchanged: r.healthUnchanged,
  })),
});
const publicLifeGiverBead = (b: LifeGiverRoundOutcome['combatBeads'][number]): LifeGiverRoundOutcome['combatBeads'][number] => ({
  id: b.id, source: b.source, paidPennies: b.paidPennies, preparedWeek: b.preparedWeek, purpose: b.purpose,
  caseId: b.caseId, status: b.status, location: b.location, spentWeek: b.spentWeek, combatRound: b.combatRound, abilityId: b.abilityId,
});
function publicLifeGiverCombat(s: SliceState): Omit<ReturnType<typeof projectLifeGiverCombat>, 'source'> {
  const panel = projectLifeGiverCombat(s), c = panel.constants, permit = panel.guestPermit;
  const wheel = (w: typeof panel.abilityWheel[number]) => ({ id: w.id, label: w.label, weight: w.weight });
  return {
    enemyName: panel.enemyName, targetId: panel.targetId, enemyMind: panel.enemyMind, enemySpirituality: panel.enemySpirituality,
    powerUses: { DARK_BOLT: panel.powerUses.DARK_BOLT, WARD: panel.powerUses.WARD, JAM: panel.powerUses.JAM },
    guestPolicy: panel.guestPolicy,
    guestPermit: permit ? {
      partnerId: permit.partnerId, encounterId: permit.encounterId, approachWeek: permit.approachWeek, paidWeek: permit.paidWeek,
      paidPence: permit.paidPence, negotiationTravelMetres: permit.negotiationTravelMetres, negotiationSeconds: permit.negotiationSeconds, visitNumber: permit.visitNumber,
    } : null,
    partner: publicLifeGiverPartner(panel.partner), combatBeads: panel.combatBeads.map(publicLifeGiverBead),
    vitalityUses: panel.vitalityUses, vitalitySuccesses: panel.vitalitySuccesses, staminaRestored: panel.staminaRestored,
    shelterUses: panel.shelterUses, shelterSuccesses: panel.shelterSuccesses, shelterEffects: panel.shelterEffects,
    shelterBroken: panel.shelterBroken, totalPlayerHealthSpent: panel.totalPlayerHealthSpent,
    gateOpen: panel.gateOpen, shelterOpen: panel.shelterOpen,
    constants: {
      weights: { physique: c.weights.physique, perception: c.weights.perception, will: c.weights.will, knowledge: c.weights.knowledge },
      tier: c.tier, floor: c.floor, maxSpirituality: c.maxSpirituality, continuingRecovery: c.continuingRecovery,
      enemyPhysique: c.enemyPhysique, vitalityCost: c.vitalityCost, vitalityRestore: c.vitalityRestore, shelterCost: c.shelterCost,
      shelterPlayerHealthCost: c.shelterPlayerHealthCost, shelterGuestStaminaCost: c.shelterGuestStaminaCost,
      shelterBonusReduction: c.shelterBonusReduction, newSkillDifficulty: c.newSkillDifficulty,
    },
    countWheel: panel.countWheel.map(wheel), enemyCountWheel: panel.enemyCountWheel.map(wheel),
    abilityWheel: panel.abilityWheel.map(wheel), enemyAbilityWheel: panel.enemyAbilityWheel.map(wheel),
    originalExit: panel.originalExit, pursuit: panel.pursuit, distanceMetres: panel.distanceMetres,
    exitTravelMetres: panel.exitTravelMetres, exitSeconds: panel.exitSeconds, summary: panel.summary,
  };
}
/** Resolved Life Giver facts only; the replay source and cursor remain private. */
function publicLifeGiverRoundOutcome(o: LifeGiverRoundOutcome): NonNullable<SlicePublicCombatRound['lifeGiverOutcome']> {
  const injury = (i: LifeGiverRoundOutcome['playerInjuriesAfter'][number]) => ({
    id: i.id, severity: i.severity, acquiredRevision: i.acquiredRevision, treatedRevision: i.treatedRevision,
  });
  return {
    targetId: o.targetId, round: o.round, stance: o.stance, continuing: o.continuing,
    enemyHealth: o.enemyHealth, enemyMind: o.enemyMind, enemySpirituality: o.enemySpirituality, enemyStatus: o.enemyStatus,
    playerSpiritualityBefore: o.playerSpiritualityBefore, playerSpiritualityAfter: o.playerSpiritualityAfter,
    playerHealthAfter: o.playerHealthAfter, playerHealthBeforeInjury: o.playerHealthBeforeInjury,
    playerMindAfter: o.playerMindAfter, enemySpiritualityBefore: o.enemySpiritualityBefore,
    powerUses: { DARK_BOLT: o.powerUses.DARK_BOLT, WARD: o.powerUses.WARD, JAM: o.powerUses.JAM },
    partnerAfter: publicLifeGiverPartner(o.partnerAfter),
    papersAfter: o.papersAfter.map(paper => ({
      id: paper.id, batch: paper.batch, source: paper.source, purchasedWeek: paper.purchasedWeek, status: paper.status,
      preparedWeek: paper.preparedWeek, consumedWeek: paper.consumedWeek, consumedBy: paper.consumedBy, combatRound: paper.combatRound,
    })),
    papersConsumed: [...o.papersConsumed],
    combatBeads: o.combatBeads.map(publicLifeGiverBead),
    playerInjuriesAfter: o.playerInjuriesAfter.map(injury), enemyInjuriesAfter: o.enemyInjuriesAfter.map(injury),
    playerRiskAfter: o.playerRiskAfter, enemyRiskAfter: o.enemyRiskAfter,
    gateOpenAfter: o.gateOpenAfter, shelterOpenAfter: o.shelterOpenAfter, shelterExpired: o.shelterExpired,
    ordinaryReturnMetres: o.ordinaryReturnMetres, elapsedSeconds: o.elapsedSeconds,
    playerActions: o.playerActions.map(a => ({
      label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens, mentalPressure: a.mentalPressure,
      order: a.order, paidCost: a.paidCost, physicalFactor: a.physicalFactor, rolls: [...a.rolls],
      id: a.id, paperId: a.paperId, beadId: a.beadId, guestStaminaSpent: a.guestStaminaSpent,
      guestStaminaRestored: a.guestStaminaRestored, playerHealthSpent: a.playerHealthSpent,
      summoned: a.summoned, cooperated: a.cooperated, vitalityResult: a.vitalityResult, shelterResult: a.shelterResult, shelterApplied: a.shelterApplied,
    })),
    enemyActions: o.enemyActions.map(a => ({
      label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens, mentalPressure: a.mentalPressure,
      order: a.order, paidCost: a.paidCost, physicalFactor: a.physicalFactor, rolls: [...a.rolls],
      planned: a.planned, actual: a.actual, gateDestroyed: a.gateDestroyed, shelterDestroyed: a.shelterDestroyed,
      guestMindDamage: a.guestMindDamage, guestHealthDamage: a.guestHealthDamage, guestStaminaSpent: a.guestStaminaSpent,
    })),
    vitalityUses: o.vitalityUses, vitalitySuccesses: o.vitalitySuccesses, staminaRestored: o.staminaRestored,
    shelterUses: o.shelterUses, shelterSuccesses: o.shelterSuccesses, shelterEffects: o.shelterEffects,
    shelterBroken: o.shelterBroken, totalPlayerHealthSpent: o.totalPlayerHealthSpent,
  };
}
function publicCombatRound(round: SliceState['lastCombatRound']): SlicePublicCombatRound | null {
  if(!round)return null;
  const {timeWormOutcome,fateTrojanOutcome,starKeyOutcome,planeswalkerOutcome,ferrymanOutcome,deathConsulOutcome,paleEmperorOutcome,pureWhiteAngelOutcome,lightSeekerOutcome,seaKingOutcome,thunderGodOutcome,allKnowingEyeOutcome,wisdomAngelOutcome,natureWalkerOutcome,handOfOrderOutcome,princeOfAbolitionOutcome,attendantMysteriesOutcome,conquerorOutcome,writerOutcome,civilizationEnlightenerOutcome,knowledgeMentorOutcome,beautyGoddessOutcome,lifeGiverOutcome,misfortuneKnightOutcome,concealmentServantOutcome,fearBishopOutcome,...facts}=clone(round);
  return {...facts,...(timeWormOutcome?{timeWormOutcome:projectTimeWormRoundOutcome(timeWormOutcome)}:{}),...(fateTrojanOutcome?{fateTrojanOutcome:projectFateTrojanRoundOutcome(fateTrojanOutcome)}:{}),...(starKeyOutcome?{starKeyOutcome:projectStarKeyRoundOutcome(starKeyOutcome)}:{}),...(planeswalkerOutcome?{planeswalkerOutcome:projectPlaneswalkerRoundOutcome(planeswalkerOutcome)}:{}),...(ferrymanOutcome?{ferrymanOutcome:projectFerrymanRoundOutcome(ferrymanOutcome)}:{}),...(deathConsulOutcome?{deathConsulOutcome:projectDeathConsulRoundOutcome(deathConsulOutcome)}:{}),...(paleEmperorOutcome?{paleEmperorOutcome:projectPaleEmperorRoundOutcome(paleEmperorOutcome)}:{}),...(pureWhiteAngelOutcome?{pureWhiteAngelOutcome:projectPureWhiteAngelRoundOutcome(pureWhiteAngelOutcome)}:{}),...(lightSeekerOutcome?{lightSeekerOutcome:projectLightSeekerRoundOutcome(lightSeekerOutcome)}:{}),...(seaKingOutcome?{seaKingOutcome:projectSeaKingRoundOutcome(seaKingOutcome)}:{}),...(thunderGodOutcome?{thunderGodOutcome:projectThunderGodRoundOutcome(thunderGodOutcome)}:{}),...(allKnowingEyeOutcome?{allKnowingEyeOutcome:projectAllKnowingEyeRoundOutcome(allKnowingEyeOutcome)}:{}),...(wisdomAngelOutcome?{wisdomAngelOutcome:projectWisdomAngelRoundOutcome(wisdomAngelOutcome)}:{}),...(misfortuneKnightOutcome?{misfortuneKnightOutcome:projectMisfortuneKnightRoundOutcome(misfortuneKnightOutcome)}:{}),...(concealmentServantOutcome?{concealmentServantOutcome:projectConcealmentServantRoundOutcome(concealmentServantOutcome)}:{}),...(fearBishopOutcome?{fearBishopOutcome:projectFearBishopRoundOutcome(fearBishopOutcome)}:{}),...(lifeGiverOutcome?{lifeGiverOutcome:publicLifeGiverRoundOutcome(lifeGiverOutcome)}:{}),...(beautyGoddessOutcome?{beautyGoddessOutcome:projectBeautyGoddessRoundOutcome(beautyGoddessOutcome)}:{}),...(knowledgeMentorOutcome?{knowledgeMentorOutcome:projectKnowledgeMentorRoundOutcome(knowledgeMentorOutcome)}:{}),...(civilizationEnlightenerOutcome?{civilizationEnlightenerOutcome:projectCivilizationEnlightenerRoundOutcome(civilizationEnlightenerOutcome)}:{}),...(writerOutcome?{writerOutcome:projectWriterRoundOutcome(writerOutcome)}:{}),...(conquerorOutcome?{conquerorOutcome:projectConquerorRoundOutcome(conquerorOutcome)}:{}),...(natureWalkerOutcome?{natureWalkerOutcome:projectNatureWalkerRoundOutcome(natureWalkerOutcome)}:{}),...(princeOfAbolitionOutcome?{princeOfAbolitionOutcome:projectPrinceOfAbolitionRoundOutcome(princeOfAbolitionOutcome)}:{}),...(handOfOrderOutcome?{handOfOrderOutcome:projectHandOfOrderRoundOutcome(handOfOrderOutcome)}:{}),...(attendantMysteriesOutcome?{attendantMysteriesOutcome:projectAttendantMysteriesRoundOutcome(attendantMysteriesOutcome)}:{})};
}

const success=(tier:string)=>tier==='SUCCESS'||tier==='GREAT_SUCCESS';
function note(s:SliceState,title:string,text:string){const entry={id:`record-${s.revision+1}-${s.chronicle.length}`,week:s.week,title,text};s.chronicle.push(entry);s.lastResult=entry;return entry;}
function knowledge(s:SliceState,title:string,text:string){s.knowledge.push({...note(s,title,text)});}
function open(s:SliceState,id:string){if(s.activeEvent){s.eventQueue.push(id);return;}s.activeEvent={id,instanceId:`${s.runId}:${id}:${s.revision+1}:${s.chronicle.length}`};}
function check(s:SliceState,ability:PublicCoreStatKey,difficulty:number){const r=new DeterministicActionRandomStream(s.random.seed,s.random.cursor);const result=resolveNormalCheck({ability,baseAbility:s.character.coreStats[ability],difficulty,modifiers:[],roll:r.nextInt(1,100)});s.random.cursor=r.cursor;s.lastCheck=result;return result;}
function seerContext(s:SliceState){return {roll(min:number,max:number){const rng=new DeterministicActionRandomStream(s.random.seed,s.random.cursor);const value=rng.nextInt(min,max);s.random.cursor=rng.cursor;return value;},note:(title:string,text:string)=>note(s,title,text),check:(ability:PublicCoreStatKey,difficulty:number)=>check(s,ability,difficulty)};}
function caseCheck(s:SliceState,ability:PublicCoreStatKey,difficulty:number){
 if(s.progression.pathwayId==='diviner'&&s.seer.omen&&!s.seer.omen.used){difficulty=Math.max(0,difficulty-5);s.seer.omen.used=true;note(s,'预示与当前调查对应','已准备的预示用于这一次首案检定，难度降低5；没有新增事实。');}
 return check(s,ability,difficulty);
}
function addDebt(s:SliceState,source:string,amount:number,weeklyPayment:number){if(amount<=0)return;s.debts.push({id:`debt-${s.week}-${s.revision+1}-${s.debts.length}`,source,remaining:amount,weeklyPayment,createdWeek:s.week});}
function debtTotal(s:SliceState){return s.debts.reduce((n,d)=>n+d.remaining,0);}
function clearDebt(s:SliceState,before:number){if(before>0&&debtTotal(s)===0){s.missedWeeks=0;s.credit='NORMAL';note(s,'账目结清','最后一笔应付款已结清。旧记录保留，当前不再要求还款。');}}
function repay(s:SliceState,amount:number){const before=debtTotal(s);let remaining=Math.min(amount,before);s.cash-=remaining;for(const d of s.debts){const paid=Math.min(d.remaining,remaining);d.remaining-=paid;remaining-=paid;}clearDebt(s,before);}
function treat(s:SliceState){for(const i of s.injuries)if(i.severity==='HEAVY'&&i.treatedRevision===null)i.treatedRevision=s.revision+1;if(s.aid==='ACCEPTED'||s.aid==='CORRECT'){s.aid='CANCELLED';s.aidInjuryIds=[];}note(s,'普通伤口已处置','尚未痊愈：之后至少一次休养，并达到80健康，才能解除重伤。');}
export function createSliceRun(runId:string,selection:SliceCreationSelection,seed:string):SliceState{
  requireRule(typeof runId==='string'&&runId.length>0&&runId.length<=200,'周目编号无效。');
  new DeterministicActionRandomStream(seed);
  const v=computeSliceCreation(selection), p=v.character;
  const s:SliceState={schemaVersion:216,contentVersion:'error-ascent-v216',errorAscent:createErrorAscentState(),door:createDoorState(),death:createDeathState(),sun:createSunState(),tyrant:createTyrantState(),whiteTower:createWhiteTowerState(),darkness:createDarknessState(),moon:createMoonState(),perfecter:createPerfecterState(),visionary:createVisionaryState(),redPriest:createRedPriestState(),fool:createFoolState(),natureWalker:createNatureWalkerState(),handOfOrder:createHandOfOrderState(),princeOfAbolition:createPrinceOfAbolitionState(),mercurySnake:createMercurySnakeState(),abomination:createAbominationState(),uncleanMonarch:createUncleanMonarchState(),darkAngel:createDarkAngelState(),knowledgeEmperor:createKnowledgeEmperorState(),apocalypseDemoness:createApocalypseDemonessState(),divineHand:createDivineHandState(),timeWorm:createTimeWormState(),starKey:createStarKeyState(),paleEmperor:createPaleEmperorState(),pureWhiteAngel:createPureWhiteAngelState(),thunderGod:createThunderGodState(),allKnowingEye:createAllKnowingEyeState(),misfortuneKnight:createMisfortuneKnightState(),beautyGoddess:createBeautyGoddessState(),civilizationEnlightener:createCivilizationEnlightenerState(),writer:createWriterState(),conqueror:createConquerorState(),attendantMysteries:createAttendantMysteriesState(),barrenMatriarch:createBarrenMatriarchState(),balancer:createBalancerState(),entropyDuke:createEntropyDukeState(),fateProphet:createFateProphetState(),ancientEvil:createAncientEvilState(),bloodDuke:createBloodDukeState(),elder:createElderState(),sage:createSageState(),calamityDemoness:createCalamityDemonessState(),glory:createGloryState(),fateTrojan:createFateTrojanState(),planeswalker:createPlaneswalkerState(),deathConsul:createDeathConsulState(),lightSeeker:createLightSeekerState(),catastrophe:createCatastropheState(),wisdomAngel:createWisdomAngelState(),concealmentServant:createConcealmentServantState(),lifeGiver:createLifeGiverState(),knowledgeMentor:createKnowledgeMentorState(),discerner:createDiscernerState(),weatherWarlock:createWeatherWarlockState(),miracleWorker:createMiracleWorkerState(),coffinBearer:createCoffinBearerState(),chaosHunter:createChaosHunterState(),frenzyMage:createFrenzyMageState(),chaosWalker:createChaosWalkerState(),silentDisciple:createSilentDiscipleState(),blatherer:createBlathererState(),threeHeadedTemplar:createThreeHeadedTemplarState(),prophecyMaster:createProphecyMasterState(),unagingDemoness:createUnagingDemonessState(),silverKnight:createSilverKnightState(),deceitMentor:createDeceitMentorState(),wanderer:createWandererState(),ferryman:createFerrymanState(),justiceMentor:createJusticeMentorState(),seaKing:createSeaKingState(),insightScholar:createInsightScholarState(),fearBishop:createFearBishopState(),summoningMaster:createSummoningMasterState(),arcaneScholar:createArcaneScholarState(),dreamWeaver:createDreamWeaverState(),warBishop:createWarBishopState(),ancientScholar:createAncientScholarState(),longChapter:createLongChapterState(),ancientAlchemist:createAncientAlchemistState(),imperativeMage:createImperativeMageState(),fallenEarl:createFallenEarlState(),misfortuneMage:createMisfortuneMageState(),puppet:createPuppetState(),devil:createDevilState(),blackKnight:createBlackKnightState(),mystic:createMysticState(),despair:createDespairState(),demonHunter:createDemonHunterState(),parasite:createParasiteState(),secretsSorcerer:createSecretsSorcererState(),undying:createUndyingState(),unshadowed:createUnshadowedState(),cataclysmPriest:createCataclysmPriestState(),prophet:createProphetState(),nightwatcher:createNightwatcherState(),witchKing:createWitchKingState(),alchemist:createAlchemistState(),manipulator:createManipulatorState(),ironBloodKnight:createIronBloodKnightState(),bizarroSorcerer:createBizarroSorcererState(),druid:createDruidState(),punishmentKnight:createPunishmentKnightState(),mentorDisorder:createMentorDisorderState(),winner:createWinnerState(),wraith:createWraithState(),desireApostle:createDesireApostleState(),shepherd:createShepherdState(),starMystic:createStarMysticState(),pain:createPainState(),guardian:createGuardianState(),dreamStealer:createDreamStealerState(),traveler:createTravelerState(),gatekeeper:createGatekeeperState(),priestOfLight:createPriestOfLightState(),oceanSinger:createOceanSingerState(),mysticismMagister:createMysticismMagisterState(),spiritWarlock:createSpiritWarlockState(),crimsonScholar:createCrimsonScholarState(),astronomer:createAstronomerState(),dreamwalker:createDreamwalkerState(),reaper:createReaperState(),marionettist:createMarionettistState(),biologist:createBiologistState(),judge:createJudgeState(),corruptionBaron:createCorruptionBaronState(),calamityPriest:createCalamityPriestState(),zombie:createZombieState(),demon:createDemonState(),roseBishop:createRoseBishopState(),scrollProfessor:createScrollProfessorState(),pleasure:createPleasureState(),dawnPaladin:createDawnPaladinState(),fireThief:createFireThiefState(),recorder:createRecorderState(),spiritGuide:createSpiritGuideState(),notary:createNotaryState(),windBlessed:createWindBlessedState(),polymath:createPolymathState(),soother:createSootherState(),potionProfessor:createPotionProfessorState(),artisan:createArtisanState(),hypnotist:createHypnotistState(),conspirator:createConspiratorState(),faceless:createFacelessState(),harvestpriest:createHarvestpriestState(),physician:createPhysicianState(),cultivator:createCultivatorState(),interrogator:createInterrogatorState(),sheriff:createSheriffState(),arbiter:createArbiterState(),briber:createBriberState(),barbarian:createBarbarianState(),lawyer:createLawyerState(),lucky:createLuckyState(),machine:createMachineState(),monster:createMonsterState(),werewolf:createWerewolfState(),madman:createMadmanState(),prisoner:createPrisonerState(),serialKiller:createSerialKillerState(),unwinged:createUnwingedState(),criminal:createCriminalState(),shadowAscetic:createShadowAsceticState(),listener:createListenerState(),secretSupplicant:createSecretSupplicantState(),wizard:createWizardState(),combatScholar:createCombatScholarState(),pryer:createPryerState(),witch:createWitchState(),instigator:createInstigatorState(),assassin:createAssassinState(),weaponmaster:createWeaponmasterState(),gladiator:createGladiatorState(),warrior:createWarriorState(),cryptologist:createCryptologistState(),swindler:createSwindlerState(),marauder:createMarauderState(),astrologer:createAstrologerState(),trickmaster:createTrickmasterState(),apprentice:createApprenticeState(),spiritmedium:createSpiritmediumState(),gravedigger:createGravediggerState(),corpsecollector:createCorpsecollectorState(),sunpriest:createSunpriestState(),lightprayer:createLightprayerState(),bard:createBardState(),navigator:createNavigatorState(),rager:createRagerState(),sailor:createSailorState(),detective:createDetectiveState(),reasoner:createReasonerState(),reader:createReaderState(),nightmare:createNightmareState(),midnight:createMidnightState(),sleepless:createSleeplessState(),vampire:createVampireState(),appraiser:createAppraiserState(),psychologist:createPsychologistState(),pyromaniac:createPyromaniacState(),magician:createMagicianState(),tamer:createTamerState(),apothecary:createApothecaryState(),archaeologist:createArchaeologistState(),savant:createSavantState(),town:createTownState(),mindreader:createMindreaderState(),audience:createAudienceState(),provoker:createProvokerState(),hunter:createHunterState(),caseArchive:[],clown:createClownState(),runId,revision:1,status:'ACTIVE',
    character:{name:p.displayName,portraitId:selection.portraitId,age:p.age,gender:p.sex,originId:p.origin.id,originName:p.origin.label,professionId:p.profession.id,professionName:p.profession.label,education:v.educationLevel,learningBonus:v.learningKnowledgeBonus,weeklyWage:v.weeklyWorkPayPence,coreStats:{...p.coreStats},birthplace:{id:p.birthplace.id,label:p.birthplace.label},appearanceDescription:p.appearanceDescription,traits:p.traits.map(t=>({id:t.id,label:t.label})),flaw:{id:p.flaw.id,label:p.flaw.label},acceptedConditionIds:[...v.selection.acceptedConditionIds],creationCosts:{professionInitialPence:v.cashBreakdown.professionInitialPence,familyTransferPence:v.cashBreakdown.familyTransferPence,conditionCostPence:v.cashBreakdown.conditionCostPence,educationCostPence:v.cashBreakdown.educationCostPence}},
    week:1,date:{epoch:'FIFTH_EPOCH',year:1349,month:6,day:28},actionsRemaining:3,weeklyBudget:3,wagePaidWeek:null,
    cash:v.cashPence,lifeTier:v.livingStandardId,nextLifeTier:v.livingStandardId,health:100,mind:100,spirituality:15,injuries:[],injuryRisk:0,
    debts:v.initialDebtPence>0?[{id:'opening-debt',source:'开局家庭欠款',remaining:v.initialDebtPence,weeklyPayment:v.debtWeeklyRepaymentPence,createdWeek:0}]:[],missedWeeks:0,credit:'NORMAL',
    knownTargets:[],completedTopics:[],knowledge:[],chronicle:[],activeEvent:null,eventQueue:[],pulse:'NONE',billAmount:0,lastMedicalInviteWeek:null,
    aid:'NONE',aidInjuryIds:[],marketUnlocked:false,careKnown:false,
    arc:{stage:'NOT_STARTED',startWeek:null,completedAWeek:null,bPaid:false,managementAlert:0,immediateTransferPrevented:false,originalLedger:false,credibleWitness:false,fullCrossLedger:false,necessaryCrossLedger:false,reportWeek:null,credibleReport:false,crisis:false,workers:null,accountability:null,hazard:null,relationship:'NO_RELATION',transferPending:false},
    world:{city:'BACKLUND',messageChannel:true,audrey:'AVAILABLE',intermediaryAvailable:true,maeveAvailable:true,manager:'ACTIVE',successorRegistered:false,organizationAvailable:true,organizationEligible:true,organizationArrived:false,bell:'ACTIVE',bellHolder:'CARRIER',bellAtScene:true,bellFactKnown:false,transferKnown:false,carrierAlive:true,carrierCanResist:true,destructionSource:null,responsibilityEvidence:true,recordsAvailable:true,careAvailable:true,aidBatchAvailable:false},
    combat:null,lastCombatRound:null,combatHistory:[],lastCheck:null,lastResult:null,ending:null,random:{seed,cursor:0},progression:emptyProgression(),seer:createSeerState()};
  note(s,'来到贝克兰德','你以普通人的身份开始生活。公开夜班工钱告示和诊疗告示都可以主动核实。');
  open(s,v.originOpeningId);return s;
}
const workersLabels={MOST_SAVED:'大多数仍可救的工人获救',SOME_SAVED:'部分工人获救',HEAVY_CASUALTIES:'工人遭受严重伤亡'};
const accountLabels={PUBLIC_CASE:'形成可公开追责的案件',PARTIAL_EVIDENCE:'保留部分证据',COVERED_UP:'证据不足，责任未获公开追究'};
const hazardLabels={CONTAINED_BY_NIGHTHAWKS:'危害已由值夜者接管',SECURED_TEMPORARILY:'危险物暂时控制，仍待正规处置',ESCAPED_WITH_CARRIER:'携带者带物离开',DESTROYED_VERIFIED:'危险物作用已确实终止',LOCATION_UNCONFIRMED:'去向尚未确认'};
const relationLabels={TRUSTED_CONTACT:'可信合作',CAUTIOUS_DISTANCE:'谨慎保持距离',NO_RELATION:'未建立委托关系'};
function finish(s:SliceState,kind:SliceEnding['kind']){
  s.status=kind==='DEATH'?'DEAD':'SLICE_COMPLETE';s.arc.stage='ENDED';s.activeEvent=null;s.eventQueue=[];s.pulse='NONE';
  if(kind==='DEATH'){s.aid=s.aid==='DELIVERED'?'DELIVERED':'CANCELLED';s.combat=null;}
  const publicKnown=s.world.city==='BACKLUND';
  s.ending={kind,title:kind==='DEATH'?'最终死亡 · 周目封存':kind==='ABANDONED'?'停止追查 · 首案归档':'首案收尾 · 卷宗留存',summary:kind==='DEATH'?'没有能够阻止这次死亡的能力或即时救援。死亡已成立，当前槽位只读封存。':'本次首案已经收尾。角色、成长、资金、伤势与欠款都已保留。',workers:s.arc.workers&&publicKnown?workersLabels[s.arc.workers]:'案件尚未完成，后续未获核实',accountability:s.arc.accountability&&publicKnown?accountLabels[s.arc.accountability]:'尚未完成追责',hazard:s.arc.hazard&&publicKnown?(s.arc.hazard==='ESCAPED_WITH_CARRIER'&&s.world.bellHolder==='OTHER'?'箱子已由他人带离现场，尚未追回':hazardLabels[s.arc.hazard]):'后续去向未获核实',relationship:relationLabels[s.arc.relationship]};
  note(s,s.ending.title,[s.ending.workers,s.ending.accountability,s.ending.hazard,s.ending.relationship].join('；'));
}
/** Consume actual item/person facts before any baseline ending writes. */
function hazard(s:SliceState,baseline:HazardOutcome):HazardOutcome{
  const w=s.world;
  if(w.bell==='DESTROYED_VERIFIED')return 'DESTROYED_VERIFIED';
  if(w.bell==='CONTAINED'&&w.bellHolder==='ORGANIZATION')return 'CONTAINED_BY_NIGHTHAWKS';
  if(w.bell==='SECURED'||w.bellHolder==='PLAYER')return 'SECURED_TEMPORARILY';
  if(w.bell==='TRANSFERRED'||w.bellHolder==='OTHER')return !w.bellAtScene&&w.transferKnown?'ESCAPED_WITH_CARRIER':'LOCATION_UNCONFIRMED';
  if(baseline==='ESCAPED_WITH_CARRIER'){
    if(w.bellHolder==='CARRIER'&&w.carrierAlive&&w.carrierCanResist){w.bellAtScene=false;return baseline;}
    return 'LOCATION_UNCONFIRMED';
  }
  if(baseline==='CONTAINED_BY_NIGHTHAWKS'&&w.organizationArrived&&w.bellAtScene){w.bell='CONTAINED';w.bellHolder='ORGANIZATION';return baseline;}
  if(baseline==='SECURED_TEMPORARILY'&&w.bellAtScene){w.bell='SECURED';w.bellHolder='PLAYER';w.carrierCanResist=false;return baseline;}
  return 'LOCATION_UNCONFIRMED';
}
function setAxes(s:SliceState,workers:WorkersOutcome,accountability:AccountabilityOutcome,hazardBaseline:HazardOutcome){
  // Previously committed rescue/evidence survives alternate cards. Irreversible casualties never improve.
  s.arc.workers=s.arc.crisis||s.arc.workers==='HEAVY_CASUALTIES'?'HEAVY_CASUALTIES':s.arc.workers??workers;
  const ranks={COVERED_UP:0,PARTIAL_EVIDENCE:1,PUBLIC_CASE:2};
  if(s.arc.accountability===null||ranks[accountability]>ranks[s.arc.accountability])s.arc.accountability=accountability;
  s.arc.hazard=hazard(s,hazardBaseline);
}
function abandon(s:SliceState){
  if(s.arc.crisis||(['ACTIVE','TRANSFERRED'].includes(s.world.bell)&&s.world.bellAtScene&&s.arc.workers===null))setAxes(s,'HEAVY_CASUALTIES','COVERED_UP','ESCAPED_WITH_CARRIER');
  else {s.arc.hazard=hazard(s,'ESCAPED_WITH_CARRIER');s.arc.accountability=s.arc.accountability??(s.arc.originalLedger||s.arc.fullCrossLedger?'PARTIAL_EVIDENCE':'COVERED_UP');}
  finish(s,'ABANDONED');
}
function finishScene(s:SliceState){
  if(s.world.bell!=='DESTROYED_VERIFIED'&&!s.world.bellAtScene&&(s.world.bell==='TRANSFERRED'||s.world.bellHolder==='OTHER')){s.arc.transferPending=true;open(s,'ARC-C-TRANSFER');}
  else finish(s,'COMPLETED');
}
function submitReport(s:SliceState){
  s.arc.reportWeek=s.week;s.arc.credibleReport=s.arc.originalLedger||s.arc.credibleWitness;
  note(s,'提交已知证据',s.arc.credibleReport?'可信报告已送达可接触的教会渠道。只有经过周脉冲且对方可用，才能实际到场。':'材料已提交，但不足以组成可信报告，不能保证组织介入。');
}
function cOutcome(s:SliceState,choice:string,mode:string){
  if(choice==='C_TRAP_PURSUIT'){
    requireRule(s.progression.pathwayId==='hunter'&&s.hunter.trapHeld>0&&s.hunter.trapDeployed===0&&!s.world.organizationArrived,'需要本人持有原件，现场尚无陷阱且仍由你独自追击。');
    s.hunter.trapHeld--;s.hunter.trapDeployed++;s.hunter.trapLocation='FIRST_CASE';
    note(s,'原件布在锅炉房门口','你在携铃者尚未靠近的锅炉房窄门内侧，把实际绳索固定于原木桩。本次到场行动包括布置；只有他真实沿此门接近打击才会触发，其他动作不会。离场未触发的原件留在封存现场。');
    cOutcome(s,'C_PURSUIT',mode);return;
  }
  if(choice==='C_SIGHT'){
    requireRule(s.progression.pathwayId==='diviner'&&s.world.bellAtScene&&['ACTIVE','TRANSFERRED'].includes(s.world.bell)&&!s.seer.completedSources.includes('first-case-sight-attempt'),'当前没有新的现场灵视目标。');
    s.seer.completedSources.push('first-case-sight-attempt');const r=caseCheck(s,'perception',8);
    knowledge(s,'灵视核对眼前异常',success(r.tier)?'眼前铜铃附近的灵性扰动与工人迟滞的状态相连。只能确认这一局部异常，无法从中得知制造者或完整用途。':'眼前的色彩与杂乱扰动尚不能稳定对应；不据此编造幕后原因。');
    if(success(r.tier)){awardSeerMastery(s,'first-case-sight',8,seerContext(s));s.progression.acting=Math.min(100,s.progression.acting+12);}
    open(s,'ARC-C');return;
  }
  if(choice==='WITHDRAW'){
    setAxes(s,'SOME_SAVED',s.arc.fullCrossLedger||s.arc.originalLedger?'PARTIAL_EVIDENCE':'COVERED_UP','ESCAPED_WITH_CARRIER');finish(s,'ABANDONED');return;
  }
  if(choice==='HELP') {setAxes(s,'MOST_SAVED',s.arc.fullCrossLedger?'PARTIAL_EVIDENCE':'COVERED_UP','DESTROYED_VERIFIED');finishScene(s);return;}
  if(choice==='C_PURSUIT'){
    if(s.world.organizationArrived){const r=caseCheck(s,'perception',18);setAxes(s,'SOME_SAVED',s.arc.fullCrossLedger?'PARTIAL_EVIDENCE':'COVERED_UP',success(r.tier)?'CONTAINED_BY_NIGHTHAWKS':'ESCAPED_WITH_CARRIER');finishScene(s);}
    else{s.arc.stage='COMBAT';s.combat={encounterId:'FIRST_CASE',round:1,enemyHealth:100,enemyMind:100,enemyInjuries:[],enemyRisk:0,enemyStatus:'RESISTING',lastRound:null};note(s,'追击携铃者','携铃者持短棍抵抗。双方使用独立次数盘与能力盘；单回合败北不直接结束战斗。');}
    return;
  }
  const isEvidence=choice==='C_EVIDENCE'||choice==='RECORD';
  if(choice==='RECORD'&&!s.world.recordsAvailable){setAxes(s,'SOME_SAVED',s.arc.originalLedger||s.arc.fullCrossLedger?'PARTIAL_EVIDENCE':'COVERED_UP','DESTROYED_VERIFIED');finishScene(s);return;}
  const r=caseCheck(s,isEvidence?'knowledge':'will',isEvidence?16:17),ok=success(r.tier),great=r.tier==='GREAT_SUCCESS',bad=r.tier==='GREAT_FAILURE';
  let workers:WorkersOutcome=isEvidence?(ok?'SOME_SAVED':'HEAVY_CASUALTIES'):(ok?'MOST_SAVED':'SOME_SAVED');
  let account:AccountabilityOutcome=isEvidence?(great?'PUBLIC_CASE':ok?(s.arc.fullCrossLedger&&(s.arc.originalLedger||s.arc.credibleWitness)?'PUBLIC_CASE':'PARTIAL_EVIDENCE'):bad?'COVERED_UP':'PARTIAL_EVIDENCE'):(ok&&s.arc.fullCrossLedger?'PARTIAL_EVIDENCE':'COVERED_UP');
  if(mode==='ARC-C-DESTROYED'){workers='SOME_SAVED';if(!ok)account=bad?'COVERED_UP':'PARTIAL_EVIDENCE';}
  let baseline:HazardOutcome=ok?(s.world.organizationArrived?'CONTAINED_BY_NIGHTHAWKS':isEvidence?'SECURED_TEMPORARILY':'ESCAPED_WITH_CARRIER'):'ESCAPED_WITH_CARRIER';
  if(mode==='ARC-C-MANAGER'&&!s.world.responsibilityEvidence&&account==='PUBLIC_CASE')account='PARTIAL_EVIDENCE';
  if(mode==='ARC-C-MANAGER') baseline=s.world.bell==='CONTAINED'?'CONTAINED_BY_NIGHTHAWKS':s.world.bell==='SECURED'?'SECURED_TEMPORARILY':!s.world.bellAtScene?'ESCAPED_WITH_CARRIER':'LOCATION_UNCONFIRMED';
  const bellExposure=['ACTIVE','TRANSFERRED'].includes(s.world.bell)&&s.world.bellAtScene;
  let crossedZero=false;
  if(bad&&bellExposure){const oldH=s.health,oldM=s.mind;if(isEvidence)s.mind=Math.max(-4,s.mind-4);else{s.health=Math.max(-4,s.health-4);s.mind=Math.max(-8,s.mind-8);}crossedZero=(oldH>0&&s.health<=0)||(oldM>0&&s.mind<=0);note(s,'铃声暴露',`健康 ${oldH}→${s.health}，精神 ${oldM}→${s.mind}。无污染新增。`);}
  setAxes(s,workers,account,baseline);note(s,'现场选择已结算',`${isEvidence?'取证':'疏散'}：${r.tier}，检定 ${r.roll}/${r.chance}。`);
  if(crossedZero)open(s,'ZERO-BELL-01');else finishScene(s);
}
function schedule(s:SliceState){
  if(s.arc.credibleReport&&s.arc.reportWeek!==null&&s.week>s.arc.reportWeek&&s.world.organizationAvailable&&s.world.organizationEligible)s.world.organizationArrived=true;
  if(s.arc.stage==='WAIT_B'&&s.arc.completedAWeek!==null&&s.week>s.arc.completedAWeek&&s.world.city==='BACKLUND'){
    if(s.world.intermediaryAvailable&&s.world.audrey!=='GONE'){s.arc.stage='B';open(s,'ARC-B');}
    else if(s.world.audrey==='GONE'||s.week>=s.arc.completedAWeek+2){s.arc.stage='C_AVAILABLE';knowledge(s,'委托无法继续','原中间人不可用，未支付调查费用。你仍可沿已确认的共同记忆断片独自调查锅炉房。');}
  }
  if(s.arc.startWeek!==null&&s.week>=s.arc.startWeek+3&&!['ENDED','NOT_STARTED','COMBAT'].includes(s.arc.stage)){
    if(['ACTIVE','TRANSFERRED'].includes(s.world.bell)&&s.world.bellAtScene&&s.arc.workers===null){s.arc.crisis=true;s.arc.workers='HEAVY_CASUALTIES';}
    if(s.world.city==='ELSEWHERE'){
      if(s.world.messageChannel)open(s,'ARC-REMOTE-CLOSE');else{abandon(s);}
    }else if(s.arc.stage!=='B')open(s,'ARC-CRISIS');
  }
}
function processPulse(s:SliceState){
  if(hasErrorAscentLock(s)||hasDoorLock(s)||hasDeathLock(s)||hasSunLock(s)||hasTyrantLock(s)||hasWhiteTowerLock(s)||hasDarknessLock(s)||hasMoonLock(s)||hasPerfecterLock(s)||hasVisionaryLock(s)||hasRedPriestLock(s)||hasFoolLock(s)||hasNatureWalkerLock(s)||hasHandOfOrderLock(s)||hasPrinceOfAbolitionLock(s)||hasMercurySnakeLock(s)||hasAbominationLock(s)||hasUncleanMonarchLock(s)||hasDarkAngelLock(s)||hasKnowledgeEmperorLock(s)||hasApocalypseDemonessLock(s)||hasDivineHandLock(s)||hasTimeWormLock(s)||hasStarKeyLock(s)||hasPaleEmperorLock(s)||hasPureWhiteAngelLock(s)||hasThunderGodLock(s)||hasAllKnowingEyeLock(s)||hasMisfortuneKnightLock(s)||hasBeautyGoddessLock(s)||hasCivilizationEnlightenerLock(s)||hasWriterLock(s)||hasConquerorLock(s)||s.attendantMysteries.preparation!==null||hasAttendantMysteriesTownLock(s)||hasAttendantMysteriesLifeLock(s)||hasBarrenMatriarchLock(natureWalkerInheritedView(s))||hasBalancerLock(handOfOrderInheritedView(s))||hasEntropyDukeLock(s)||hasFateProphetLock(s)||hasAncientEvilLock(s)||hasBloodDukeLock(s)||hasElderLock(s)||hasSageLock(s)||hasCalamityDemonessLock(s)||hasGloryLock(s)||hasFateTrojanLock(s)||hasPlaneswalkerLock(s)||hasDeathConsulLock(s)||hasLightSeekerLock(s)||hasCatastropheLock(s)||hasWisdomAngelLock(s)||hasConcealmentServantLock(s)||hasLifeGiverLock(s)||hasKnowledgeMentorLock(s)||hasDiscernerLock(s)||hasWeatherWarlockLock(s)||hasCoffinBearerLock(natureWalkerInheritedView(s))||hasChaosHunterLock(handOfOrderInheritedView(s))||hasFrenzyMageLock(s)||hasChaosWalkerLock(s)||hasSilentDiscipleLock(s)||hasBlathererLock(s)||hasThreeHeadedTemplarLock(s)||hasProphecyMasterLock(s)||hasUnagingDemonessLock(s)||hasSilverKnightLock(s)||hasDeceitMentorLock(s)||hasWandererLock(s)||hasFerrymanLock(s)||hasJusticeMentorLock(s)||hasSeaKingLock(s)||hasInsightScholarLock(s)||hasFearBishopLock(s)||hasSummoningMasterLock(s)||hasArcaneScholarLock(s)||hasDreamWeaverLock(s)||hasWarBishopLock(s)||hasAncientScholarLock(s)||hasAncientScholarEraClosure(s)||hasLongChapterLock(s)||isLongChapterEraClosed(s))return;
  if(s.status!=='ACTIVE'||s.activeEvent||s.combat)return;
  if(s.eventQueue.length){open(s,s.eventQueue.shift()!);return;}
  if(s.actionsRemaining>0&&s.pulse==='NONE')return;
  if(longChapterBlocksOrdinaryPulse(s))return;
  if(s.pulse==='NONE')s.pulse='BILL';
  if(s.pulse==='BILL'||s.pulse==='DEBTS'){
    const finance=resolveSliceWeeklyFinance(s);Object.assign(s,finance.state);
    for(const receipt of finance.receipts)note(s,receipt.title,receipt.text);
    if(finance.eventId){open(s,finance.eventId);return;}
  }
  if(s.pulse==='ADVANCE'){s.week+=1;s.date=addGameWeeks(s.date,1);s.actionsRemaining=s.weeklyBudget;s.lifeTier=s.nextLifeTier;s.pulse='NONE';s.billAmount=0;note(s,'新的一周',`日期推进7天，本周${s.actionsRemaining}次行动。`);schedule(s);}
}
function rest(s:SliceState){
  const life=SLICE_LIFE[s.lifeTier],before=s.health;s.health=Math.min(100,s.health+life.health);s.mind=Math.min(100,s.mind+life.mind);const maxS=(s.progression.pathwayId==='diviner'||s.progression.pathwayId==='hunter'||s.progression.pathwayId==='audience'||s.progression.pathwayId==='paragon'||s.progression.pathwayId==='moon'||s.progression.pathwayId==='darkness'||s.progression.pathwayId==='white-tower'||s.progression.pathwayId==='tyrant'||s.progression.pathwayId==='sun'||s.progression.pathwayId==='death'||s.progression.pathwayId==='door'||s.progression.pathwayId==='error'||s.progression.pathwayId==='warrior'||s.progression.pathwayId==='demoness'||s.progression.pathwayId==='hermit'||s.progression.pathwayId==='hanged-man'||s.progression.pathwayId==='abyss'||s.progression.pathwayId==='chained'||s.progression.pathwayId==='wheel'||s.progression.pathwayId==='black-emperor'||s.progression.pathwayId==='justiciar'||s.progression.pathwayId==='mother')&&s.progression.sequence===1?120:(s.progression.pathwayId==='diviner'||s.progression.pathwayId==='hunter'||s.progression.pathwayId==='audience'||s.progression.pathwayId==='paragon'||s.progression.pathwayId==='moon'||s.progression.pathwayId==='darkness'||s.progression.pathwayId==='white-tower'||s.progression.pathwayId==='tyrant'||s.progression.pathwayId==='sun'||s.progression.pathwayId==='death'||s.progression.pathwayId==='door'||s.progression.pathwayId==='error'||s.progression.pathwayId==='warrior'||s.progression.pathwayId==='demoness'||s.progression.pathwayId==='hermit'||s.progression.pathwayId==='hanged-man'||s.progression.pathwayId==='abyss'||s.progression.pathwayId==='chained'||s.progression.pathwayId==='wheel'||s.progression.pathwayId==='black-emperor'||s.progression.pathwayId==='justiciar'||s.progression.pathwayId==='mother')&&s.progression.sequence===2?120:(s.progression.pathwayId==='diviner'||s.progression.pathwayId==='hunter'||s.progression.pathwayId==='audience'||s.progression.pathwayId==='paragon'||s.progression.pathwayId==='moon'||s.progression.pathwayId==='darkness'||s.progression.pathwayId==='white-tower'||s.progression.pathwayId==='tyrant'||s.progression.pathwayId==='sun'||s.progression.pathwayId==='death'||s.progression.pathwayId==='door'||s.progression.pathwayId==='error'||s.progression.pathwayId==='warrior'||s.progression.pathwayId==='demoness'||s.progression.pathwayId==='hermit'||s.progression.pathwayId==='hanged-man'||s.progression.pathwayId==='abyss'||s.progression.pathwayId==='chained'||s.progression.pathwayId==='wheel'||s.progression.pathwayId==='black-emperor'||s.progression.pathwayId==='justiciar'||s.progression.pathwayId==='mother')&&s.progression.sequence===3?120:(s.progression.pathwayId==='diviner'||s.progression.pathwayId==='hunter'||s.progression.pathwayId==='audience'||s.progression.pathwayId==='paragon'||s.progression.pathwayId==='moon'||s.progression.pathwayId==='darkness'||s.progression.pathwayId==='white-tower'||s.progression.pathwayId==='tyrant'||s.progression.pathwayId==='sun'||s.progression.pathwayId==='death'||s.progression.pathwayId==='door'||s.progression.pathwayId==='error'||s.progression.pathwayId==='warrior'||s.progression.pathwayId==='demoness'||s.progression.pathwayId==='hermit'||s.progression.pathwayId==='hanged-man'||s.progression.pathwayId==='abyss'||s.progression.pathwayId==='chained'||s.progression.pathwayId==='wheel'||s.progression.pathwayId==='black-emperor'||s.progression.pathwayId==='justiciar'||s.progression.pathwayId==='mother')&&s.progression.sequence===4?120:s.progression.sequence===5?100:s.progression.sequence===6?80:s.progression.sequence===7?60:s.progression.sequence===8?45:s.progression.pathwayId!==null?30:15;s.spirituality=Math.min(maxS,s.spirituality+maxS*life.spirituality);s.seer.pollution=Math.max(0,s.seer.pollution-10);
  const old=s.injuries.length;s.injuries=s.injuries.filter(i=>!(s.health>=80&&i.acquiredRevision<s.revision+1&&(i.severity==='LIGHT'||(i.treatedRevision!==null&&i.treatedRevision<s.revision+1))));
  note(s,'完成休养',`健康${before}→${s.health}；精神${s.mind}，灵性${s.spirituality}。`);
  if(old>s.injuries.length){if(!s.injuries.length)s.injuryRisk=0;note(s,'可以重新用力了',`实际解除${old-s.injuries.length}份伤势。${s.injuries.length?'其余伤势仍保留。':'所有伤势真正痊愈，累计带伤再败风险已清除。'}`);}
  if(s.injuries.some(i=>i.severity==='HEAVY'&&i.treatedRevision===null)&&s.careKnown&&s.world.careAvailable&&s.lastMedicalInviteWeek!==s.week){
    s.lastMedicalInviteWeek=s.week;
    if(s.cash<60&&s.credit==='SUSPENDED'&&s.world.aidBatchAvailable&&!['ACCEPTED','CORRECT','DELIVERED'].includes(s.aid))open(s,'CARE-WORK-OFFER');else open(s,'LIFE-CARE-01');
  }
}
function investigate(s:SliceState,targetId:string){
  if(targetId==='LIFE-LEAD-NIGHTSHIFT'){s.arc.stage='A';s.arc.startWeek=s.week;knowledge(s,'夜班工钱记录不符','公开告示招工记录与一份未结工钱记录日期不符。');open(s,'ARC-A');return;}
  if(targetId==='ARC-C'){s.arc.stage='C';s.world.bellFactKnown=true;open(s,'ARC-C');return;}
  if(targetId==='CARE-ACCESS-01'){s.careKnown=true;s.world.aidBatchAvailable=true;knowledge(s,'诊疗点已核实','这处普通诊疗点提供普通伤口处置；本次没有治疗或收费。');return;}
  if(targetId==='lead.market.contact'){open(s,'MARKET-CONTACT-01');return;}
  if(targetId==='CARE-WORK-CHECK'||targetId==='CARE-WORK-CORRECT'){
    const ok=targetId==='CARE-WORK-CORRECT'||success(check(s,'perception',12).tier);
    if(ok){s.aid='DELIVERED';s.world.aidBatchAvailable=false;treat(s);note(s,'医疗援助已兑现','签条批次已经交付，按约作一次普通处置。没有现金奖励，旧债保留。');}else{s.aid='CORRECT';note(s,'签条仍需复核','还未达到交换要求。可以再花一次调查按标记确定复核，或取消委托。');}return;
  }
  const o=SLICE_ORIGIN_EVENTS.find(x=>x.lead===targetId)!;s.knownTargets=s.knownTargets.filter(id=>id!==targetId);knowledge(s,o.label,o.result);if(['O01','O02','O03','O04'].includes(o.code)&&!s.knownTargets.includes('lead.market.contact'))s.knownTargets.push('lead.market.contact');
}
function choose(s:SliceState,choice:string,id:string){
  const o=SLICE_ORIGIN_EVENTS.find(x=>x.id===id);
  if(o){if(choice==='.accept')s.knownTargets.push(o.lead);note(s,o.title,choice==='.accept'?`你记下了这件事，可以在调查中核实。${o.acceptReason}。`:`你没有接下这件事，对方知道了你的决定。${o.declineReason}。`);return;}
  if(id==='ARC-A'&&choice==='A_OBSERVE'){
    requireRule(s.progression.pathwayId==='audience','需要观众的观察能力。');const r=check(s,'perception',12);const ok=success(r.tier);
    knowledge(s,'迟疑之后的实际交谈',ok?'你注意到工友在管理者经过时收声，等对方离开后私下询问。他自愿陈述了本人夜班的一段记忆缺口，并同意你记录。可信来源是这次实际证词，不是从表情读出了内心。':'工友在管理者经过时收声，但暂时不愿回答。你只记下这个可见动作，没有把迟疑改写为证词。');
    if(ok){s.arc.credibleWitness=true;awardSeerMastery(s,'first-case-audience',8,seerContext(s));}
    s.arc.stage='WAIT_B';s.arc.completedAWeek=s.week;return;
  }
  if(id==='ARC-A'&&choice==='A_TRACK'){
    requireRule(s.progression.pathwayId==='hunter','需要猎人能力。');const r=check(s,'perception',10);
    knowledge(s,'雨后货轮印',success(r.tier)?'你沿夜班出入口检查新旧轮印与泥水覆盖顺序，确认最近一辆运货车驶向旧锅炉房方向。印痕只能说明这一段路线，不能证明乘车人的身份或幕后指使。':'雨水抹去了关键重叠处。你保留工钱与宿舍的原始疑点，没有给不清楚的轮印编出方向。');
    if(success(r.tier)){awardSeerMastery(s,'first-case-tracking',8,seerContext(s));s.progression.acting=Math.min(100,s.progression.acting+12);}
    s.arc.stage='WAIT_B';s.arc.completedAWeek=s.week;return;
  }
  if(id==='ARC-A'){
    const r=caseCheck(s,choice==='A_LEDGER'?'knowledge':choice==='A_WORKERS'?'perception':'will',choice==='A_LEDGER'?14:choice==='A_WORKERS'?15:18);
    const ok=success(r.tier),bad=r.tier==='GREAT_FAILURE';
    if(choice==='A_FOREMAN'&&r.tier==='GREAT_SUCCESS')s.arc.immediateTransferPrevented=true;
    if(choice==='A_LEDGER'&&ok)s.arc.originalLedger=true;if(choice==='A_WORKERS'&&ok)s.arc.credibleWitness=true;
    if(bad)s.arc.managementAlert=Math.min(2,s.arc.managementAlert+2);else if(choice==='A_FOREMAN'&&!ok)s.arc.managementAlert=Math.min(2,s.arc.managementAlert+1);
    const lines:Record<string,string[]>={A_LEDGER:['完整补写链已确认。','账目矛盾已确认。','存在一处无法解释的账目缺口。','副本具有诱导性，检查显然被提前准备。'],A_WORKERS:['两份独立证词支持共同记忆断片。','取得一份可信工友证词。','确认工人普遍害怕开口。','证人受到警告，但不能据此编造真相。'],A_FOREMAN:['时间口供矛盾，立即转移已暂时受阻。','口供与记录冲突。','没有直接供述，管理方更警觉。','你被禁止进入工场，仍可走工友与委托人入口。']};
    knowledge(s,'第一阶段线索',lines[choice]![['GREAT_SUCCESS','SUCCESS','FAILURE','GREAT_FAILURE'].indexOf(r.tier)]!);s.arc.stage='WAIT_B';s.arc.completedAWeek=s.week;return;
  }
  if(id==='ARC-B'){
    if(!s.arc.bPaid){s.cash+=choice==='B_SHARE'?240:choice==='B_LIMITED'?120:0;s.arc.bPaid=true;}
    s.arc.fullCrossLedger=choice==='B_SHARE';s.arc.necessaryCrossLedger=choice==='B_LIMITED';s.arc.relationship=choice==='B_SHARE'?'TRUSTED_CONTACT':choice==='B_LIMITED'?'CAUTIOUS_DISTANCE':'NO_RELATION';s.arc.stage='C_AVAILABLE';knowledge(s,'共同记忆断片','已确认的工伤工资记录与共同记忆断片相连，旧锅炉房成为可调查目标。');open(s,'ARC-REPORT');return;
  }
  if(id==='ARC-B-CANCEL'){s.arc.stage='C_AVAILABLE';knowledge(s,'独立追查','委托未建立，未收取费用。根据已有线索，旧锅炉房仍可调查。');return;}
  if(id==='ARC-REPORT'){if(choice==='REPORT')submitReport(s);else note(s,'暂不举报','你保留了现有证据，仍可独立追查。');return;}
  if(id==='ARC-CRISIS'){if(choice==='INTERVENE'){s.arc.stage='C';s.world.bellFactKnown=true;open(s,'ARC-C');}else{abandon(s);}return;}
  if(['ARC-C','ARC-C-MANAGER','ARC-C-DESTROYED','C_WITHDRAW_UNFIT'].includes(id)){cOutcome(s,choice,id);return;}
  if(id==='ZERO-BELL-01'){finishScene(s);return;}
  if(id==='ARC-C-TRANSFER'){if(choice==='REPORT_TRANSFER')submitReport(s);s.arc.transferPending=false;finish(s,'COMPLETED');return;}
  if(id==='ARC-REMOTE-CLOSE'){if(choice==='SEND_KNOWN')submitReport(s);abandon(s);return;}
  if(id==='MARKET-CONTACT-01'){if(choice==='VERIFY'){s.marketUnlocked=true;knowledge(s,'旧物渠道已核实','渠道确实存在，但本试玩尚无正式可售货目。没有获得商品、能力或组织身份。');}else note(s,'暂不建立渠道','联系人线索仍保留，以后可主动再次核实。');return;}
  if(id==='LIFE-BILL-01'){const paid=choice==='PAY_PART'?Math.min(s.cash,s.billAmount):0;s.cash-=paid;addDebt(s,'生活应付款',s.billAmount-paid,30);s.nextLifeTier='DESTITUTE';note(s,'生活账单已处理',`实际支付${paid}便士，余款${s.billAmount-paid}便士计欠。下周转赤贫。`);s.pulse='DEBTS';return;}
  if(id==='LIFE-CARE-01'){if(choice==='PAY'){s.cash-=60;treat(s);}else if(choice==='CREDIT'){addDebt(s,'诊疗点医疗欠款',60,12);treat(s);}else note(s,'暂不处置伤口','基础休养结果保留，重伤仍未处置。');return;}
  if(id==='CARE-WORK-OFFER'){if(choice==='ACCEPT'){s.aid='ACCEPTED';s.aidInjuryIds=s.injuries.filter(i=>i.severity==='HEAVY'&&i.treatedRevision===null).map(i=>i.id);note(s,'接下签条核对','已登记本批签条。调查完成后才兑现医疗处置。');}else note(s,'暂不接下援助','伤势和欠款保留，本周不重复邀请。');return;}
  if(id==='DEBT-NOTICE-01'){note(s,'还款安排',choice==='PLAN'?'已说明下周按约偿还；仍要以实际入账为准。':'现在不作还款承诺；债务与欠付周数不变。');return;}
  if(id==='DEBT-SETTLE-01'){if(choice==='PAY'){const amount=Math.min(s.cash,debtTotal(s));repay(s,amount);note(s,'偿还欠款',`实际偿还${amount}便士。`);}else note(s,'保留欠款继续谋生','新增信用暂停，工作、调查与现款交易仍可进行。');}
}
/** Both strict raw intents and private owned drafts use this exact publisher. */
function applyFoolSliceIntent(state:SliceState,payload:Extract<SliceIntent,{type:'FOOL'}>,head?:FoolOwnedEngine):{state:SliceState;head:FoolOwnedEngine|undefined}{
  requireRule(state.status==='ACTIVE','已经死亡或结束的角色不能继续行动。');
  const next=clone(state);next.lastCheck=null;
  let nextHead:FoolOwnedEngine|undefined;
  try{
    if(head)nextHead=applyOwnedFoolCommand(next,payload.command,seerContext(next),head);
    else applyFoolCommand(next,payload.command,seerContext(next));
    if(next.health<=0)finish(next,'DEATH');
  }
  catch{throw new SliceRuleError((head?ownedFoolCommandBlock(state,payload.command,head):foolCommandBlock(state,payload.command))??'当前不能进行愚者行动。');}
  next.revision=state.revision+1;return {state:next,head:nextHead};
}
/** Both strict raw intents and private owned drafts use this exact publisher. */
function applyRedPriestSliceIntent(state:SliceState,payload:Extract<SliceIntent,{type:'RED_PRIEST'}>,head?:RedPriestOwnedEngine):{state:SliceState;head:RedPriestOwnedEngine|undefined}{
  requireRule(state.status==='ACTIVE','已经死亡或结束的角色不能继续行动。');
  const next=clone(state);next.lastCheck=null;
  let nextHead:RedPriestOwnedEngine|undefined;
  try{
    if(head)nextHead=applyOwnedRedPriestCommand(next,payload.command,seerContext(next),head);
    else applyRedPriestCommand(next,payload.command,seerContext(next));
    if(next.health<=0)finish(next,'DEATH');
  }
  catch{throw new SliceRuleError((head?ownedRedPriestCommandBlock(state,payload.command,head):redPriestCommandBlock(state,payload.command))??'当前不能进行红祭司行动。');}
  next.revision=state.revision+1;return {state:next,head:nextHead};
}
function applyVisionarySliceIntent(state:SliceState,payload:Extract<SliceIntent,{type:'VISIONARY'}>,head?:VisionaryOwnedEngine):{state:SliceState;head:VisionaryOwnedEngine|undefined}{
  requireRule(state.status==='ACTIVE','已经死亡或结束的角色不能继续行动。');
  const next=clone(state);next.lastCheck=null;
  let nextHead:VisionaryOwnedEngine|undefined;
  try{
    if(head)nextHead=applyOwnedVisionaryCommand(next,payload.command,seerContext(next),head);
    else applyVisionaryCommand(next,payload.command,seerContext(next));
    if(next.health<=0)finish(next,'DEATH');
  }
  catch{throw new SliceRuleError((head?ownedVisionaryCommandBlock(state,payload.command,head):visionaryCommandBlock(state,payload.command))??'当前不能进行空想家行动。');}
  next.revision=state.revision+1;return {state:next,head:nextHead};
}
function applyPerfecterSliceIntent(state:SliceState,payload:Extract<SliceIntent,{type:'PERFECTER'}>,head?:PerfecterOwnedEngine):{state:SliceState;head:PerfecterOwnedEngine|undefined}{
  requireRule(state.status==='ACTIVE','已经死亡或结束的角色不能继续行动。');
  const next=clone(state);next.lastCheck=null;
  let nextHead:PerfecterOwnedEngine|undefined;
  try{
    if(head)nextHead=applyOwnedPerfecterCommand(next,payload.command,seerContext(next),head);
    else applyPerfecterCommand(next,payload.command,seerContext(next));
    if(next.health<=0)finish(next,'DEATH');
  }
  catch{throw new SliceRuleError((head?ownedPerfecterCommandBlock(state,payload.command,head):perfecterCommandBlock(state,payload.command))??'当前不能进行完美者行动。');}
  next.revision=state.revision+1;return {state:next,head:nextHead};
}
function applyMoonSliceIntent(state:SliceState,payload:Extract<SliceIntent,{type:'MOON'}>,head?:MoonOwnedEngine):{state:SliceState;head:MoonOwnedEngine|undefined}{
  requireRule(state.status==='ACTIVE','已经死亡或结束的角色不能继续行动。');
  const next=clone(state);next.lastCheck=null;
  let nextHead:MoonOwnedEngine|undefined;
  try{
    if(head)nextHead=applyOwnedMoonCommand(next,payload.command,seerContext(next),head);
    else applyMoonCommand(next,payload.command,seerContext(next));
    if(next.health<=0)finish(next,'DEATH');
  }
  catch{throw new SliceRuleError((head?ownedMoonCommandBlock(state,payload.command,head):moonCommandBlock(state,payload.command))??'当前不能进行月亮行动。');}
  next.revision=state.revision+1;return {state:next,head:nextHead};
}
function applyErrorAscentSliceIntent(state:SliceState,payload:Extract<SliceIntent,{type:'ERROR_ASCENT'}>,head?:ErrorAscentOwnedEngine):{state:SliceState;head:ErrorAscentOwnedEngine|undefined}{
  requireRule(state.status==='ACTIVE','已经死亡或结束的角色不能继续行动。');
  // Validate the untouched prior receipt first; ErrorAscent.publish replaces it
  // with this action's actual check (or null) after a successful draft.
  const next=clone(state);
  let nextHead:ErrorAscentOwnedEngine|undefined;
  try{
    if(head)nextHead=applyOwnedErrorAscentCommand(next,payload.command,seerContext(next),head);
    else applyErrorAscentCommand(next,payload.command,seerContext(next));
    if(next.health<=0)finish(next,'DEATH');
  }
  catch{throw new SliceRuleError((head?ownedErrorAscentCommandBlock(state,payload.command,head):errorAscentCommandBlock(state,payload.command))??'当前不能进行错误行动。');}
  next.revision=state.revision+1;return {state:next,head:nextHead};
}
function applyDoorSliceIntent(state:SliceState,payload:Extract<SliceIntent,{type:'DOOR'}>,head?:DoorOwnedEngine):{state:SliceState;head:DoorOwnedEngine|undefined}{
  requireRule(state.status==='ACTIVE','已经死亡或结束的角色不能继续行动。');
  // Validate the untouched prior receipt first; Door.publish replaces it
  // with this action's actual check (or null) after a successful draft.
  const next=clone(state);
  let nextHead:DoorOwnedEngine|undefined;
  try{
    if(head)nextHead=applyOwnedDoorCommand(next,payload.command,seerContext(next),head);
    else applyDoorCommand(next,payload.command,seerContext(next));
    if(next.health<=0)finish(next,'DEATH');
  }
  catch{throw new SliceRuleError((head?ownedDoorCommandBlock(state,payload.command,head):doorCommandBlock(state,payload.command))??'当前不能进行门行动。');}
  next.revision=state.revision+1;return {state:next,head:nextHead};
}
function applyDeathSliceIntent(state:SliceState,payload:Extract<SliceIntent,{type:'DEATH'}>,head?:DeathOwnedEngine):{state:SliceState;head:DeathOwnedEngine|undefined}{
  requireRule(state.status==='ACTIVE','已经死亡或结束的角色不能继续行动。');
  // Validate the untouched prior receipt first; Death.publish replaces it
  // with this action's actual check (or null) after a successful draft.
  const next=clone(state);
  let nextHead:DeathOwnedEngine|undefined;
  try{
    if(head)nextHead=applyOwnedDeathCommand(next,payload.command,seerContext(next),head);
    else applyDeathCommand(next,payload.command,seerContext(next));
    if(next.health<=0)finish(next,'DEATH');
  }
  catch{throw new SliceRuleError((head?ownedDeathCommandBlock(state,payload.command,head):deathCommandBlock(state,payload.command))??'当前不能进行死神行动。');}
  next.revision=state.revision+1;return {state:next,head:nextHead};
}
function applySunSliceIntent(state:SliceState,payload:Extract<SliceIntent,{type:'SUN'}>,head?:SunOwnedEngine):{state:SliceState;head:SunOwnedEngine|undefined}{
  requireRule(state.status==='ACTIVE','已经死亡或结束的角色不能继续行动。');
  const next=clone(state);next.lastCheck=null;
  let nextHead:SunOwnedEngine|undefined;
  try{
    if(head)nextHead=applyOwnedSunCommand(next,payload.command,seerContext(next),head);
    else applySunCommand(next,payload.command,seerContext(next));
    if(next.health<=0)finish(next,'DEATH');
  }
  catch{throw new SliceRuleError((head?ownedSunCommandBlock(state,payload.command,head):sunCommandBlock(state,payload.command))??'当前不能进行太阳行动。');}
  next.revision=state.revision+1;return {state:next,head:nextHead};
}
function applyTyrantSliceIntent(state:SliceState,payload:Extract<SliceIntent,{type:'TYRANT'}>,head?:TyrantOwnedEngine):{state:SliceState;head:TyrantOwnedEngine|undefined}{
  requireRule(state.status==='ACTIVE','已经死亡或结束的角色不能继续行动。');
  const next=clone(state);next.lastCheck=null;
  let nextHead:TyrantOwnedEngine|undefined;
  try{
    if(head)nextHead=applyOwnedTyrantCommand(next,payload.command,seerContext(next),head);
    else applyTyrantCommand(next,payload.command,seerContext(next));
    if(next.health<=0)finish(next,'DEATH');
  }
  catch{throw new SliceRuleError((head?ownedTyrantCommandBlock(state,payload.command,head):tyrantCommandBlock(state,payload.command))??'当前不能进行暴君行动。');}
  next.revision=state.revision+1;return {state:next,head:nextHead};
}
function applyWhiteTowerSliceIntent(state:SliceState,payload:Extract<SliceIntent,{type:'WHITE_TOWER'}>,head?:WhiteTowerOwnedEngine):{state:SliceState;head:WhiteTowerOwnedEngine|undefined}{
  requireRule(state.status==='ACTIVE','已经死亡或结束的角色不能继续行动。');
  const next=clone(state);next.lastCheck=null;
  let nextHead:WhiteTowerOwnedEngine|undefined;
  try{
    if(head)nextHead=applyOwnedWhiteTowerCommand(next,payload.command,seerContext(next),head);
    else applyWhiteTowerCommand(next,payload.command,seerContext(next));
    if(next.health<=0)finish(next,'DEATH');
  }
  catch{throw new SliceRuleError((head?ownedWhiteTowerCommandBlock(state,payload.command,head):whiteTowerCommandBlock(state,payload.command))??'当前不能进行白塔行动。');}
  next.revision=state.revision+1;return {state:next,head:nextHead};
}
function applyDarknessSliceIntent(state:SliceState,payload:Extract<SliceIntent,{type:'DARKNESS'}>,head?:DarknessOwnedEngine):{state:SliceState;head:DarknessOwnedEngine|undefined}{
  requireRule(state.status==='ACTIVE','已经死亡或结束的角色不能继续行动。');
  const next=clone(state);next.lastCheck=null;
  let nextHead:DarknessOwnedEngine|undefined;
  try{
    if(head)nextHead=applyOwnedDarknessCommand(next,payload.command,seerContext(next),head);
    else applyDarknessCommand(next,payload.command,seerContext(next));
    if(next.health<=0)finish(next,'DEATH');
  }
  catch{throw new SliceRuleError((head?ownedDarknessCommandBlock(state,payload.command,head):darknessCommandBlock(state,payload.command))??'当前不能进行黑暗行动。');}
  next.revision=state.revision+1;return {state:next,head:nextHead};
}
export function applySliceIntent(state:SliceState,payload:SliceIntent):SliceState{
  if(payload.type==='ERROR_ASCENT')return applyErrorAscentSliceIntent(state,payload).state;
  requireRule(!hasErrorAscentHistory(state),'原有经历已经封存，请在当前错误晋升筹备与仪式现场继续行动。');
  if(payload.type==='DOOR')return applyDoorSliceIntent(state,payload).state;
  requireRule(!hasDoorHistory(state),'原有经历已经封存，请在当前门途径筹备处与居民服务现场继续行动。');
  if(payload.type==='DEATH')return applyDeathSliceIntent(state,payload).state;
  requireRule(!hasDeathHistory(state),'原有经历已经封存，请在当前接待处与死神筹备现场继续行动。');
  if(payload.type==='SUN')return applySunSliceIntent(state,payload).state;
  requireRule(!hasSunHistory(state),'原有经历已经封存，请在当前街区与筹备处继续行动。');
  if(payload.type==='TYRANT')return applyTyrantSliceIntent(state,payload).state;
  requireRule(!hasTyrantHistory(state),'原有经历已经封存，请在当前海岸与筹备处继续行动。');
  if(payload.type==='WHITE_TOWER')return applyWhiteTowerSliceIntent(state,payload).state;
  requireRule(!hasWhiteTowerHistory(state),'原有经历已经封存，请在当前城市通路与筹备处继续行动。');
  if(payload.type==='DARKNESS')return applyDarknessSliceIntent(state,payload).state;
  requireRule(!hasDarknessHistory(state),'原有经历已经封存，请在当前长夜撤离与筹备处继续行动。');
  if(payload.type==='MOON')return applyMoonSliceIntent(state,payload).state;
  requireRule(!hasMoonHistory(state),'原有经历已经封存，请在当前夜航与筹备处继续行动。');
  if(payload.type==='PERFECTER')return applyPerfecterSliceIntent(state,payload).state;
  requireRule(!hasPerfecterHistory(state),'原有经历已经封存，请在当前工坊与大陆事务中继续行动。');
  if(payload.type==='VISIONARY')return applyVisionarySliceIntent(state,payload).state;
  requireRule(!hasVisionaryHistory(state),'原有经历已经封存，请在当前时代筹备与现场继续行动。');
  if(payload.type==='RED_PRIEST')return applyRedPriestSliceIntent(state,payload).state;
  requireRule(!hasRedPriestHistory(state),'原有经历已经封存，请在当前战役与筹备处继续行动。');
  if(payload.type==='FOOL')return applyFoolSliceIntent(state,payload).state;
  requireRule(!hasFoolHistory(state),'原有经历已经封存，请在当前筹备处与现场继续行动。');
  if(state.status==='REVIVAL_PENDING')requireRule(payload.type==='MIRACLE_WORKER'&&validateMiracleWorkerRevivalCommand(payload.command),'本人已真实死亡，当前只可作有限复起、等待或放弃选择。');
  if(payload.type==='MIRACLE_WORKER'){
    requireRule(!state.attendantMysteries.guidanceKnown && state.attendantMysteries.reception.origin === null,'已进入诡秘侍者当代筹备，请用本阶段接待处和现场；旧奇迹师记录可继续查看。');
    const next=clone(state);next.lastCheck=null;
    try{const outcome=applyMiracleWorkerCommand(next,payload.command,seerContext(next),(source,amount)=>{if(amount!==5&&amount!==8&&amount!==25)throw new Error('Invalid mastery award');awardSeerMastery(next,source,amount,seerContext(next));});if(outcome==='FINAL_DEATH')finish(next,'DEATH');}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能执行奇迹师行动。');}
    next.revision=state.revision+1;return next;
  }

  if(payload.type==='ATTENDANT_MYSTERIES'){
    const next=clone(state);next.lastCheck=null;
    try{applyAttendantMysteriesCommand(next,payload.command,seerContext(next));if(next.health<=0)finish(next,'DEATH');}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行诡秘侍者行动。');}
    next.revision=state.revision+1;return next;
  }
  if(payload.type==='ANCIENT_SCHOLAR'){
    requireRule(state.progression.sequence!==2&&state.progression.sequence!==1&&state.status==='ACTIVE'&&!hasLongChapterLock(state)&&!isLongChapterEraClosed(state),'当前角色不能进入古代学者封存或后世章节。');
    const next=clone(state);next.lastCheck=null;
    try{applyAncientScholarCommand(next,payload.command,seerContext(next));if(next.health<=0)finish(next,'DEATH');}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行古代学者行动。');}
    if(!hasAncientScholarLock(next)&&!hasAncientScholarEraClosure(next))processPulse(next);
    next.revision=state.revision+1;return next;
  }
  if(hasAncientScholarLock(state)||hasAncientScholarEraClosure(state))requireRule(payload.type==='COMBAT_ROUND'&&(state.combat?.encounterId==='ANCIENT_SCHOLAR_DISPUTE'||state.combat?.encounterId==='MIRACLE_WORKER_DISPUTE'||state.combat?.encounterId==='ATTENDANT_MYSTERIES_DISPUTE'),'隔绝或后世期间只能使用本章当前行动；旧人和旧库存仅保留历史。');
  if(payload.type==='LONG_CHAPTER'){
    requireRule(state.status==='ACTIVE','普通死亡或已结束的角色不能进入长期章节。');
    const next=clone(state);next.lastCheck=null;
    try{applyLongChapterCommand(next,payload.command,seerContext(next));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行长期章节。');}
    if(!hasLongChapterLock(next)&&!isLongChapterEraClosed(next))processPulse(next);
    next.revision=state.revision+1;return next;
  }
  if(state.thunderGod.guidanceKnown&&['SAILOR','RAGER','NAVIGATOR','WIND_BLESSED','OCEAN_SINGER','CATACLYSM_PRIEST','SEA_KING','CATASTROPHE'].includes(payload.type))requireRule(false,'原阶段履历已交接，请在雷神当前现场使用实际保留的能力与原物。');
  if(state.natureWalker.guidanceKnown&&['CULTIVATOR','PHYSICIAN','HARVESTPRIEST','BIOLOGIST','DRUID','ANCIENT_ALCHEMIST','COFFIN_BEARER','BARREN_MATRIARCH'].includes(payload.type))requireRule(false,'旧阶段履历已经交接，请在自然行者当前现场使用实际原植、根垫与原物。');
  if(state.handOfOrder.guidanceKnown&&['ARBITER','SHERIFF','INTERROGATOR','JUDGE','PUNISHMENT_KNIGHT','IMPERATIVE_MAGE','CHAOS_HUNTER','BALANCER'].includes(payload.type))requireRule(false,'旧阶段履历已经交接，请在秩序之手当前现场使用实际保留的身体、原物与护板。');
  if(state.princeOfAbolition.guidanceKnown&&['LAWYER','BARBARIAN','BRIBER','CORRUPTION_BARON','MENTOR_DISORDER','FALLEN_EARL','FRENZY_MAGE','ENTROPY_DUKE'].includes(payload.type))requireRule(false,'旧阶段履历已经交接，请在弑序亲王当前现场使用实际保留的身体、原物与木筹。');
  if(state.mercurySnake.guidanceKnown&&['MONSTER','MACHINE','LUCKY','CALAMITY_PRIEST','WINNER','MISFORTUNE_MAGE','CHAOS_WALKER','FATE_PROPHET'].includes(payload.type))requireRule(false,'旧阶段履历已经交接，请在水银之蛇当前现场使用实际保留的身体、原物和积运。');
  if(state.abomination.guidanceKnown&&['PRISONER','MADMAN','WEREWOLF','ZOMBIE','WRAITH','PUPPET','SILENT_DISCIPLE','ANCIENT_EVIL'].includes(payload.type))requireRule(false,'旧阶段履历已经交接，请在神孽当前安静室使用实际保留的身体和原物。');
  if(state.uncleanMonarch.guidanceKnown&&['CRIMINAL','UNWINGED','SERIAL_KILLER','DEMON','DESIRE_APOSTLE','DEVIL','BLATHERER','BLOOD_DUKE'].includes(payload.type))requireRule(false,'旧阶段履历已经交接，请在污秽君王当前安静室使用实际保留的身体和原物。');
  if(state.darkAngel.guidanceKnown&&['SECRET_SUPPLICANT','LISTENER','SHADOW_ASCETIC','ROSE_BISHOP','SHEPHERD','BLACK_KNIGHT','THREE_HEADED_TEMPLAR','ELDER'].includes(payload.type))requireRule(false,'旧阶段履历已经交接，请在暗天使当前封存院使用实际保留的身体和原物。');
  if(state.knowledgeEmperor.guidanceKnown&&['PRYER','COMBAT_SCHOLAR','WIZARD','SCROLL_PROFESSOR','STAR_MYSTIC','MYSTIC','PROPHECY_MASTER','SAGE'].includes(payload.type))requireRule(false,'旧阶段履历已经交接，请在知识皇帝当前档室使用实际保留的身体和原物。');
  if(state.apocalypseDemoness.guidanceKnown&&['ASSASSIN','INSTIGATOR','WITCH','PLEASURE','PAIN','DESPAIR','UNAGING_DEMONESS','CALAMITY_DEMONESS'].includes(payload.type))requireRule(false,'旧阶段履历已经交接，请在末日魔女当前画廊附室使用实际保留的身体和原物。');
  if(state.divineHand.guidanceKnown&&['WARRIOR','GLADIATOR','WEAPONMASTER','DAWN_PALADIN','GUARDIAN','DEMON_HUNTER','SILVER_KNIGHT','GLORY'].includes(payload.type))requireRule(false,'旧阶段履历已经交接，请在神明之手当前修整室使用实际保留的身体和原物。');
  if(state.timeWorm.guidanceKnown&&['MARAUDER','SWINDLER','CRYPTOLOGIST','FIRE_THIEF','DREAM_STEALER','PARASITE','DECEIT_MENTOR','FATE_TROJAN'].includes(payload.type))requireRule(false,'旧阶段履历已经交接，请在时之虫当前登记室使用实际保留的身体和原物。');
  if(state.starKey.guidanceKnown&&['APPRENTICE','TRICKMASTER','ASTROLOGER','RECORDER','TRAVELER','SECRETS_SORCERER','WANDERER','PLANESWALKER'].includes(payload.type))requireRule(false,'旧阶段履历已交接，请在星之匙当前通行室使用实际保留的能力与原物。');
  if(state.allKnowingEye.guidanceKnown&&['READER','REASONER','DETECTIVE','POLYMATH','MYSTICISM_MAGISTER','PROPHET','INSIGHT_SCHOLAR','WISDOM_ANGEL'].includes(payload.type))requireRule(false,'原阶段履历已交接，请在全知之眼当前现场使用实际保留的能力与原物。');
  if(state.progression.pathwayId==='door'&&state.progression.sequence===2&&['APPRENTICE','TRICKMASTER','ASTROLOGER','RECORDER','TRAVELER','SECRETS_SORCERER','WANDERER'].includes(payload.type))requireRule(false,'旧阶段实践与晋升已归档，请使用旅法师当前实践；原技能、记录和原物保持。');
  if(state.paleEmperor.guidanceKnown&&(['CORPSECOLLECTOR','GRAVEDIGGER','SPIRITMEDIUM','SPIRIT_GUIDE','GATEKEEPER','UNDYING','DEATH_CONSUL'].includes(payload.type)||(payload.type==='FERRYMAN'&&!validateFerrymanEraCommand(payload.command))))requireRule(false,'旧阶段履历已交接，请使用苍白皇帝当前现场或当代普通生活。');
  if(payload.type==='PALE_EMPEROR'){
    requireRule(state.status==='ACTIVE'&&((!hasLongChapterLock(state)&&!isLongChapterEraClosed(state))||hasLongChapterHandoff(state)),'先实际完成居所交接；普通死亡不能进入苍白皇帝新渠道。');
    const next=clone(state);next.lastCheck=null;
    try{applyPaleEmperorCommand(next,payload.command,seerContext(next));if(next.health<=0)finish(next,'DEATH');}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行苍白皇帝行动。');}
    if(!hasLongChapterLock(next)&&!isLongChapterEraClosed(next))processPulse(next);
    next.revision=state.revision+1;return next;
  }
  if(payload.type==='DEATH_CONSUL'){
    requireRule(state.status==='ACTIVE'&&((!hasLongChapterLock(state)&&!isLongChapterEraClosed(state))||hasLongChapterHandoff(state)),'先实际完成居所交接；普通死亡不能进入死亡执政官新渠道。');
    const next=clone(state);next.lastCheck=null;
    try{applyDeathConsulCommand(next,payload.command,seerContext(next));if(next.health<=0)finish(next,'DEATH');}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行死亡执政官行动。');}
    if(!hasLongChapterLock(next)&&!isLongChapterEraClosed(next))processPulse(next);
    next.revision=state.revision+1;return next;
  }
  if(payload.type==='FERRYMAN'){
    requireRule(state.status==='ACTIVE'&&((!hasLongChapterLock(state)&&!isLongChapterEraClosed(state))||hasLongChapterHandoff(state)),'先实际完成居所交接；普通死亡不能进入摆渡人新渠道。');
    const next=clone(state);next.lastCheck=null;
    try{if(next.paleEmperor.guidanceKnown&&validateFerrymanEraCommand(payload.command))recordPaleEmperorEraCommand(next,payload.command,seerContext(next));else applyFerrymanCommand(next,payload.command,seerContext(next));if(next.health<=0)finish(next,'DEATH');}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行摆渡人行动。');}
    if(!hasLongChapterLock(next)&&!isLongChapterEraClosed(next))processPulse(next);
    next.revision=state.revision+1;return next;
  }
  requireRule((!hasLongChapterLock(state)&&!isLongChapterEraClosed(state))||(hasLongChapterHandoff(state)&&payload.type==='COMBAT_ROUND'&&(state.combat?.encounterId==='FERRYMAN_DISPUTE'||state.combat?.encounterId==='DEATH_CONSUL_DISPUTE'||state.combat?.encounterId==='PALE_EMPEROR_DISPUTE')),'当前属于长期章节或新年代；旧人物和旧场景只能查看历史，不能继续接单。');
  if(hasFerrymanLock(state)&&!state.combat)requireRule(false,'先停止当前合作实践、归还原件或取消当周晋升准备。');
  if(hasCoffinBearerLock(natureWalkerInheritedView(state))&&!state.combat)requireRule(payload.type==='COFFIN_BEARER','先收束有限双方规则、原人原物返还、当前许可及实际原路返回。');
  if(hasChaosHunterLock(handOfOrderInheritedView(state))&&!state.combat)requireRule(payload.type==='CHAOS_HUNTER','先收束有限双方规则、原人原物返还、当前许可及实际原路返回。');
  if(hasFrenzyMageLock(state)&&!state.combat)requireRule(payload.type==='FRENZY_MAGE','先收束未发动作偏转、原人物与原物返还、当前同意及实际原路返回。');
  if(hasChaosWalkerLock(state)&&!state.combat)requireRule(payload.type==='CHAOS_WALKER','先收束原概率试验、原物返还、当前同意与实际原路返回。');
  if(hasSilentDiscipleLock(state)&&!state.combat)requireRule(payload.type==='SILENT_DISCIPLE','先收束原身体变形、同意、原物返还与实际原路返回。');
  if(hasBlathererLock(state)&&!state.combat)requireRule(payload.type==='BLATHERER','先收束有限低语、当前听者与实际原路返回。');
  if(hasThreeHeadedTemplarLock(state)&&!state.combat)requireRule(payload.type==='THREE_HEADED_TEMPLAR','先收束原灵外放、实际原物与原路返回。');
  if(hasProphecyMasterLock(state)&&!state.combat)requireRule(payload.type==='PROPHECY_MASTER','先沿真实退路结束预兆记录与真实核对现场。');
  if(hasUnagingDemonessLock(state)&&!state.combat)requireRule(payload.type==='UNAGING_DEMONESS','先沿真实退路结束原镜内道路与原物现场。');
  if(hasSilverKnightLock(state)&&!state.combat)requireRule(payload.type==='SILVER_KNIGHT','先沿真实退路结束亲猎、祝福会见或原银骑士现场。');
  if(hasDeceitMentorLock(state)&&!state.combat)requireRule(payload.type==='DECEIT_MENTOR','先停止当前有限效果、返回归还原物，或取消当前服药准备。');
  if(hasWandererLock(state)&&!state.combat)requireRule(payload.type==='WANDERER','先实际返回本地并归还原护具/原物，或取消当前服药准备。');
  if(hasJusticeMentorLock(state)&&!state.combat)requireRule(payload.type==='JUSTICE_MENTOR','先停止当前合作实践、归还原件或取消当周晋升准备。');
  if(hasSeaKingLock(state)&&!state.combat)requireRule(payload.type==='SEA_KING','先停止当前海域作用、归还原件或取消当周晋升准备。');
  if(hasInsightScholarLock(state)&&!state.combat)requireRule(payload.type==='INSIGHT_SCHOLAR','先收束当前原证据实践、归还原件或取消当周晋升准备。');
  if(hasFearBishopLock(state)&&!state.combat)requireRule(payload.type==='FEAR_BISHOP','先停止当前睡恐影响、归还原件或取消当周晋升准备。');
  if(hasSummoningMasterLock(state)&&!state.combat)requireRule(payload.type==='SUMMONING_MASTER','先实际停止原来客、归还原件或取消当周晋升准备。');
  if(hasArcaneScholarLock(state)&&!state.combat)requireRule(payload.type==='ARCANE_SCHOLAR','先实际停止原造物、归还原件或取消当周晋升准备。');
  if(hasDreamWeaverLock(state)&&!state.combat)requireRule(payload.type==='DREAM_WEAVER','先实际归并身份、停止梦像、归还原物或取消当周晋升准备。');
  if(!state.combat)requireRule(!hasPaleEmperorLock(state),'先结束残响窗口、归还原器皿并沿原门离开。');
  if(hasPureWhiteAngelLock(state)&&!state.combat)requireRule(payload.type==='PURE_WHITE_ANGEL','先结束待执行窗口、归还原试片与护片并沿原门离开。');
  if(hasThunderGodLock(state)&&!state.combat)requireRule(payload.type==='THUNDER_GOD','先停止当前窗口、收回原靶与护片并沿原湾通路离开。');
  if(hasNatureWalkerLock(state)&&!state.combat)requireRule(payload.type==='NATURE_WALKER','先收束当前有限联系、归还原物并沿原路离开，或取消服药准备。');
  if(hasHandOfOrderLock(state)&&!state.combat)requireRule(payload.type==='HAND_OF_ORDER','先收束当前有限联系、归还原物并沿原路离开，或取消服药准备。');
  if(hasPrinceOfAbolitionLock(state)&&!state.combat)requireRule(payload.type==='PRINCE_OF_ABOLITION','先收束当前有限联系、归还原物并沿原路离开，或取消服药准备。');
  if(hasMercurySnakeLock(state)&&!state.combat)requireRule(payload.type==='MERCURY_SNAKE','先收束当前有限联系、归还原物并沿原路离开，或取消服药准备。');
  if(hasAbominationLock(state)&&!state.combat)requireRule(payload.type==='ABOMINATION','先收束当前灵性束障与短声窗口，归还原物并沿原路离开。');
  if(hasUncleanMonarchLock(state)&&!state.combat)requireRule(payload.type==='UNCLEAN_MONARCH','先收束当前冲动收束与定向扰动窗口，归还原物并沿原路离开。');
  if(hasDarkAngelLock(state)&&!state.combat)requireRule(payload.type==='DARK_ANGEL','先收束当前单灵引导与护持窗口，归还原物并沿原路离开。');
  if(hasKnowledgeEmperorLock(state)&&!state.combat)requireRule(payload.type==='KNOWLEDGE_EMPEROR','先收束当前笔记与力量观察，归还原物并沿原路离开。');
  if(hasApocalypseDemonessLock(state)&&!state.combat)requireRule(payload.type==='APOCALYPSE_DEMONESS','先收束当前残留脉冲与镜面窗口，归还原物并沿原路离开。');
  if(hasDivineHandLock(state)&&!state.combat)requireRule(payload.type==='DIVINE_HAND','先收束当前载荷与护甲窗口，归还原物并沿原路离开。');
  if(hasTimeWormLock(state)&&!state.combat)requireRule(payload.type==='TIME_WORM','先收束尚未执行的查看动作与短时窗口，再沿原路离开。');
  if(hasStarKeyLock(state)&&!state.combat)requireRule(payload.type==='STAR_KEY','先结束定位或锚点窗口，归还原包并沿原门离开。');
  if(hasAllKnowingEyeLock(state)&&!state.combat)requireRule(payload.type==='ALL_KNOWING_EYE','先结束待执行窗口、归还原纸和滑轨并沿原门离开。');
  if(hasMisfortuneKnightLock(state)&&!state.combat)requireRule(payload.type==='MISFORTUNE_KNIGHT','先结束待执行窗口、归还原盒托盘并沿原门离开。');
  if(hasBeautyGoddessLock(state)&&!state.combat)requireRule(payload.type==='BEAUTY_GODDESS','先结束月光窗口、归还原灯月片并让参与者沿门口离开。');
  if(hasCivilizationEnlightenerLock(state)&&!state.combat)requireRule(payload.type==='CIVILIZATION_ENLIGHTENER','先停止原负载、归还原工具并让参与者沿门口离开。');
  if(hasWriterLock(state)&&!state.combat)requireRule(payload.type==='WRITER','先结束待执行安排、归还同一原书并让原参与者沿门口离开。');
  if(hasConquerorLock(state)&&!state.combat)requireRule(payload.type==='CONQUEROR','先收束原院现场、归还器具并让实际同伴离场。');
  if(hasAttendantMysteriesLock(state)&&!state.combat)requireRule(payload.type==='EVENT_CHOICE','先收束原现场、解除原联系并沿普通路线返回。');
  if(hasBarrenMatriarchLock(natureWalkerInheritedView(state))&&!state.combat)requireRule(payload.type==='BARREN_MATRIARCH','先停止当前约束或干扰并归还原物，沿普通出口离开，或取消服药准备。');
  if(hasBalancerLock(handOfOrderInheritedView(state))&&!state.combat)requireRule(payload.type==='BALANCER','先停止当前约束或干扰并归还原物，沿普通出口离开，或取消服药准备。');
  if(hasEntropyDukeLock(state)&&!state.combat)requireRule(payload.type==='ENTROPY_DUKE','先停止当前约束或干扰并归还原物，沿普通出口离开，或取消服药准备。');
  if(hasFateProphetLock(state)&&!state.combat)requireRule(payload.type==='FATE_PROPHET','先停止当前约束或干扰并归还原物，沿普通出口离开，或取消服药准备。');
  if(hasAncientEvilLock(state)&&!state.combat)requireRule(payload.type==='ANCIENT_EVIL','先停止当前约束或干扰并归还原物，沿普通出口离开，或取消服药准备。');
  if(hasBloodDukeLock(state)&&!state.combat)requireRule(payload.type==='BLOOD_DUKE','先停止当前约束或干扰并归还原物，沿普通出口离开，或取消服药准备。');
  if(hasElderLock(state)&&!state.combat)requireRule(payload.type==='ELDER','先结束眼前短咏并归还原物，沿普通出口离开，或取消服药准备。');
  if(hasSageLock(state)&&!state.combat)requireRule(payload.type==='SAGE','先停止当前信息施作、沿实际路线返回，或取消服药准备；灾害封存须先处理眼前阶段。');
  if(hasCalamityDemonessLock(state)&&!state.combat)requireRule(payload.type==='CALAMITY_DEMONESS','先停止当前施作、处理插片与封存箱并沿实际路线退出镜廊附室，或取消服药准备。');
  if(hasGloryLock(state)&&!state.combat)requireRule(payload.type==='GLORY','先停止当前护持、交还借物并沿实际路线退出修整室，或取消服药准备。');
  if(hasFateTrojanLock(state)&&!state.combat)requireRule(payload.type==='FATE_TROJAN','先解除当前联系、按实际位置归还原物并退出登记所，或取消服药准备。');
  if(hasPlaneswalkerLock(state)&&!state.combat)requireRule(payload.type==='PLANESWALKER','先沿已核返程回到本地、收好原件并关闭当前路线，或取消服药准备。');
  if(hasDeathConsulLock(state)&&!state.combat)requireRule(false,'先停止苍白焰与短渡、收束原物并沿实际路线退出，或取消服药准备。');
  if(hasLightSeekerLock(state)&&!state.combat)requireRule(payload.type==='LIGHT_SEEKER','先停止光照、归还遮具并沿原路退出，或取消服药准备。');
  if(hasCatastropheLock(state)&&!state.combat)requireRule(payload.type==='CATASTROPHE','先停止风浪与水压、排回同一原水并沿干路退出，或取消服药准备。');
  if(hasWisdomAngelLock(state)&&!state.combat)requireRule(payload.type==='WISDOM_ANGEL','先停止本次模型与应对、沿原路归还原件并退出，或取消服药准备。');
  if(hasConcealmentServantLock(state)&&!state.combat)requireRule(payload.type==='CONCEALMENT_SERVANT','先解除本次隐秘、经原门普通返回并归还原物，或取消服药准备。');
  if(hasLifeGiverLock(state)&&!state.combat)requireRule(payload.type==='LIFE_GIVER','先断开本次联结、实际送同一来客回家并归还原珠和借物，或取消服药准备。');
  if(hasKnowledgeMentorLock(state)&&!state.combat)requireRule(payload.type==='KNOWLEDGE_MENTOR','先停止原工序、取回同一原件与指令片并收束知识导师候选现场或取消准备。');
  if(hasDiscernerLock(state)&&!state.combat)requireRule(payload.type==='DISCERNER','先停止接触、沿原路归还原卡并收束洞察者现场或取消准备。');
  if(hasWeatherWarlockLock(state)&&!state.combat)requireRule(payload.type==='WEATHER_WARLOCK','先实际停止天气、原路退回、还物和散场或取消准备。');
  if(hasWarBishopLock(state)&&!state.combat)requireRule(payload.type==='WAR_BISHOP','先实际收束原队伍、归还原物或取消当周晋升准备。');
  if((hasAncientAlchemistLifeLock(natureWalkerInheritedView(state))||hasAncientAlchemistEncounterLock(natureWalkerInheritedView(state)))&&!state.combat)requireRule(payload.type==='ANCIENT_ALCHEMIST','先沿普通路线退出当前场地并收好原物，再继续其他行动。');
  if((hasImperativeMageLifeLock(state)||hasImperativeMageEncounterLock(state))&&!state.combat)requireRule(payload.type==='IMPERATIVE_MAGE','先沿普通路线退出当前场地并收好原物，再继续其他行动。');
  if((hasFallenEarlLifeLock(state)||hasFallenEarlEncounterLock(state))&&!state.combat)requireRule(payload.type==='FALLEN_EARL','先沿普通路线退出当前场地并收好原物，再继续其他行动。');
  if((hasMisfortuneMageLifeLock(state)||hasMisfortuneMageEncounterLock(state))&&!state.combat)requireRule(payload.type==='MISFORTUNE_MAGE','先沿普通路线退出当前场地并收好原物，再继续其他行动。');
  if((hasPuppetLifeLock(state)||hasPuppetEncounterLock(state))&&!state.combat)requireRule(payload.type==='PUPPET','先沿普通路线退出当前场地并收好原物，再继续其他行动。');
  if((hasDevilLifeLock(state)||hasDevilEncounterLock(state))&&!state.combat)requireRule(payload.type==='DEVIL','先沿普通路线退出当前场地并收好原物，再继续其他行动。');
  if((hasBlackKnightLifeLock(state)||hasBlackKnightEncounterLock(state))&&!state.combat)requireRule(payload.type==='BLACK_KNIGHT','先沿普通路线退出当前场地并收好原物，再继续其他行动。');
  if((hasMysticRitualLock(state)||hasMysticLifeLock(state)||hasMysticEncounterLock(state))&&!state.combat)requireRule(payload.type==='MYSTIC','先沿普通路线退出当前场地并收好原物，再继续其他行动。');
  if((hasDespairLifeLock(state)||hasDespairEncounterLock(state))&&!state.combat)requireRule(payload.type==='DESPAIR','先沿普通路线退出当前场地并收好原物，再继续其他行动。');
  if((hasDemonHunterLifeLock(state)||hasDemonHunterEncounterLock(state))&&!state.combat)requireRule(payload.type==='DEMON_HUNTER','先实际取回原试针、关闭柜盖并沿原路返回，再继续普通行动。');
  if((hasParasiteLifeLock(state)||hasParasiteEncounterLock(state))&&!state.combat)requireRule(payload.type==='PARASITE','先实际结束寄生接触、返回原位置并收束原借用，再继续普通行动。');
  if((hasSecretsSorcererLifeLock(state)||hasSecretsSorcererRitualLock(state))&&!state.combat)requireRule(payload.type==='SECRETS_SORCERER','先实际收束秘法师现场，通过原门、取回原物或等同一目标返回，再离开。');
  if((undyingInside(state)||hasUndyingRitualLock(state)||isInsideUndyingEncounter(state))&&!state.combat)requireRule(payload.type==='UNDYING','先实际收束当前不死者现场，归还原册或停止封印，再沿原出口离开。');
  if((unshadowedInside(state)||hasUnshadowedRitualLock(state)||isInsideUnshadowedEncounter(state))&&!state.combat)requireRule(payload.type==='UNSHADOWED','先实际收束当前无暗者现场，沿真实出口撤离或完成原仪式。');
  if((cataclysmPriestInside(state)||hasCataclysmPriestRitualLock(state)||isInsideCataclysmPriestEncounter(state))&&!state.combat)requireRule(payload.type==='CATACLYSM_PRIEST','先实际收束当前灾难主祭现场，沿真实出口撤离或完成原仪式。');
  if((prophetInside(state)||hasProphetRitualLock(state)||isInsideProphetEncounter(state))&&!state.combat)requireRule(payload.type==='PROPHET','先实际结束当前预言家现场、停止当前梦象记录并真实归还原物。');
  if((nightwatcherInside(state)||hasNightwatcherRitualLock(state)||isInsideNightwatcherEncounter(state))&&!state.combat)requireRule(payload.type==='NIGHTWATCHER','先实际结束当前守夜人现场、唤醒本人并召回同一个原灵。');
  if((witchKingInside(state)||hasWitchKingRitualLock(state)||isInsideWitchKingEncounter(state))&&!state.combat)requireRule(payload.type==='WITCH_KING','先实际结束当前巫王现场与纸人准备。');
  if((alchemistInside(state)||hasAlchemistRitualLock(state)||isInsideAlchemistEncounter(state))&&!state.combat)requireRule(payload.type==='ALCHEMIST','先实际结束当前炼金术士现场与造物操作。');
  if((manipulatorInside(state)||hasManipulatorRitualLock(state)||isInsideManipulatorEncounter(state))&&!state.combat)requireRule(payload.type==='MANIPULATOR','先实际结束当前心灵接触或群众集会。');
  if((ironBloodInside(state)||hasIronBloodRitualLock(state)||isInsideIronBloodEncounter(state))&&!state.combat)requireRule(payload.type==='IRON_BLOOD_KNIGHT','先实际收束当前铁血队伍、仪式或练习现场。');
  if((bizarroInside(state)||hasBizarroRitualLock(state))&&!state.combat)requireRule(payload.type==='BIZARRO_SORCERER'||(payload.type==='MAGICIAN'&&payload.command.type==='PREPARE_LANTERN'&&state.bizarroSorcerer.ritual.phase==='ASSEMBLED'),'先结束当前诡法师现场；仅原集结时可准备真实油灯。');
  if(druidInside(natureWalkerInheritedView(state))&&!state.combat)requireRule(payload.type==='DRUID','先0行动结束德鲁伊实践并退出原现场。');
  if(punishmentKnightInside(state)&&!state.combat)requireRule(payload.type==='PUNISHMENT_KNIGHT','先0行动结束惩戒骑士实践并退出原现场。');
  if(mentorDisorderInside(state)&&!state.combat)requireRule(payload.type==='MENTOR_DISORDER','先0行动结束混乱导师实践并退出原现场。');
  if(winnerInside(state)&&!state.combat)requireRule(payload.type==='WINNER','先0行动结束赢家实践并退出原现场。');
  if(wraithInside(state)&&!state.combat)requireRule(payload.type==='WRAITH',state.wraith.moon.pendingWeek!==null?'先实际度过本次怨魂满月极度虚弱。':'先0行动结束怨魂实践并退出原现场。');
  if(desireApostleInside(state)&&!state.combat)requireRule(payload.type==='DESIRE_APOSTLE','先0行动结束欲望使徒实践并退出原现场。');
  if(shepherdInside(state)&&!state.combat)requireRule(payload.type==='SHEPHERD','先0行动结束牧羊人实践并退出原现场。');
  if(starMysticInside(state)&&!state.combat)requireRule(payload.type==='STAR_MYSTIC','先0行动结束星象师实践并退出原现场。');
  if(painInside(state)&&!state.combat)requireRule(payload.type==='PAIN','先0行动结束痛苦魔女实践并退出原现场。');
  if(guardianInside(state)&&!state.combat)requireRule(payload.type==='GUARDIAN','先0行动结束守护者实践并退出原现场。');
  if(dreamStealerInside(state)&&!state.combat)requireRule(payload.type==='DREAM_STEALER','先0行动结束窃梦家实践并退出原现场。');
  if(travelerInside(state))requireRule(payload.type==='TRAVELER','先0行动结束旅行家实践并退出原现场。');
  if(gatekeeperInside(state))requireRule(payload.type==='GATEKEEPER','先0行动结束看门人现场、关门并取回原牌。');
  if(priestOfLightInside(state)&&!state.combat)requireRule(payload.type==='PRIEST_OF_LIGHT','先0行动结束光之祭司现场并实际返回。');
  if(oceanSingerInside(state)&&!state.combat)requireRule(payload.type==='OCEAN_SINGER','先0行动结束海洋歌者实践并退出原现场。');
  if(mysticismMagisterInside(state))requireRule(payload.type==='MYSTICISM_MAGISTER','先0行动结束秘术导师仪式接触。');
  if(spiritWarlockInside(state)&&!nightwatcherOwnsOriginalLeafDeployment(state)&&!state.combat)requireRule(payload.type==='SPIRIT_WARLOCK','先0行动结束灵巫实践并退出原现场。');
  if(crimsonScholarInside(state))requireRule(payload.type==='CRIMSON_SCHOLAR','先0行动结束深红学者实践并退出原现场。');
  if(astronomerInside(state))requireRule(payload.type==='ASTRONOMER'&&(payload.command.type==='CLOSE'||payload.command.type==='WITHDRAW'),'先0行动结束天文学家实践并退出原现场。');
  if(dreamwalkerInside(state))requireRule(payload.type==='DREAMWALKER','先结束当前梦境、沿原路返回，或归还尾羽结束本次仪式。');
  if(reaperInside(state))requireRule(payload.type==='REAPER','先0行动结束收割者实践并退出原现场。');
  if(marionettistInside(state))requireRule(payload.type==='MARIONETTIST','先结束当前仪式或灵体之线接触，可0行动停止并退出。');
  if(biologistInside(natureWalkerInheritedView(state)))requireRule(payload.type==='BIOLOGIST'&&(payload.command.type==='CLOSE'||payload.command.type==='WITHDRAW'),'先0行动结束生物学家实践并退出原现场。');
  if(judgeInside(state))requireRule(payload.type==='JUDGE'&&(payload.command.type==='CLOSE'||payload.command.type==='WITHDRAW'),'先0行动结束法官实践并退出原现场。');
  if(corruptionBaronInside(state))requireRule(payload.type==='CORRUPTION_BARON'&&(payload.command.type==='CLOSE'||payload.command.type==='WITHDRAW'),'先0行动结束腐化男爵实践并退出原现场。');
  if(calamityPriestInside(state))requireRule(payload.type==='CALAMITY_PRIEST'&&payload.command.type==='CLOSE','先0行动结束灾祸教士实践并退出原现场。');
  if(zombieInside(state))requireRule(payload.type==='ZOMBIE'&&(state.zombie.moon.pendingWeek!==null?payload.command.type==='HANDLE_MOON':payload.command.type==='CLOSE'),'先实际度过本次月圆，或0行动结束活尸实践。');
  if(demonInside(state))requireRule(payload.type==='DEMON'&&payload.command.type==='CLOSE','先0行动结束恶魔实践并退出原现场。');
  if(roseBishopInside(state))requireRule(payload.type==='ROSE_BISHOP'&&payload.command.type==='CLOSE','先0行动结束血肉调节并退出原现场。');
  if(scrollProfessorInside(state))requireRule(payload.type==='SCROLL_PROFESSOR'&&payload.command.type==='CLOSE','先0行动结束卷轴实践并退出原现场。');
  if(pleasureInside(state))requireRule(payload.type==='PLEASURE'&&payload.command.type==='CLOSE','先0行动结束丝线与交流实践并退出原现场。');
  if(dawnPaladinInside(state))requireRule(payload.type==='DAWN_PALADIN'&&payload.command.type==='CLOSE','先0行动结束晨曦实践并退出原现场。');
  if(fireThiefInside(state))requireRule(payload.type==='FIRE_THIEF'&&['CLOSE','USE','WAIT'].includes(payload.command.type),'先0行动结束暂借实践并退出原现场。');
  if(recorderInside(state))requireRule(payload.type==='RECORDER'&&payload.command.type==='CLOSE','先0行动结束记录实践并退出原现场。');
  if(spiritGuideInside(state))requireRule(payload.type==='SPIRIT_GUIDE'&&payload.command.type==='CLOSE','先0行动结束通灵实践并退出原现场。');
  if(notaryInside(state))requireRule(payload.type==='NOTARY'&&payload.command.type==='CLOSE','先0行动结束公证实践并归还原工具。');
  if(windBlessedInside(state))requireRule(payload.type==='WIND_BLESSED'&&payload.command.type==='CLOSE','先0行动结束控风练习并沿原路返回地面。');
  if(polymathInside(state))requireRule(payload.type==='POLYMATH'&&payload.command.type==='CLOSE','先0行动结束样本试演现场。');
  if(sootherInside(state))requireRule(payload.type==='SOOTHER'&&payload.command.type==='CLOSE','先0行动结束安魂现场。');
  if(potionProfessorInside(state))requireRule(payload.type==='POTION_PROFESSOR'&&payload.command.type==='CLOSE','先0行动结束药剂试验现场。');
  if(artisanInside(state))requireRule(payload.type==='ARTISAN'&&payload.command.type==='CLOSE','先0行动结束工房现场。');
  if(hypnotistInside(state))requireRule(payload.type==='HYPNOTIST'&&payload.command.type==='CLOSE','先0行动停止本次影响并退出。');
  if(conspiratorInside(state))requireRule(payload.type==='CONSPIRATOR'&&payload.command.type==='CLOSE','先0行动结束当前交涉。');
  if(facelessInside(state))requireRule(payload.type==='FACELESS'&&['CLOSE','RESTORE_SELF','WITHDRAW'].includes(payload.command.type),'先0行动结束当前无面人接触。');
  if(harvestpriestInside(natureWalkerInheritedView(state)))requireRule(payload.type==='HARVESTPRIEST'&&payload.command.type==='CLOSE','先0行动停止练习并退开。');
  if(physicianInside(natureWalkerInheritedView(state)))requireRule(payload.type==='PHYSICIAN'&&payload.command.type==='CLOSE','先0行动停止练习并退开。');
  if(cultivatorInside(natureWalkerInheritedView(state)))requireRule(payload.type==='CULTIVATOR'&&payload.command.type==='CLOSE','先0行动放回原记录并结束本次交谈。');
  if(interrogatorInside(state))requireRule(payload.type==='INTERROGATOR'&&payload.command.type==='CLOSE','先0行动停止练习并退开。');
  if(sheriffInside(state))requireRule(payload.type==='SHERIFF'&&payload.command.type==='CLOSE','先0行动停止练习并退开。');
  if(arbiterInside(state))requireRule(payload.type==='ARBITER'&&payload.command.type==='CLOSE','先0行动放回原记录并结束本次交谈。');
  if(briberInside(state))requireRule(payload.type==='BRIBER'&&payload.command.type==='CLOSE','先0行动结束本次给予与练习。');
  if(barbarianInside(state))requireRule(payload.type==='BARBARIAN'&&payload.command.type==='CLOSE','先0行动放稳原物并结束本次练习。');
  if(lawyerInside(state))requireRule(payload.type==='LAWYER'&&payload.command.type==='CLOSE','先0行动放回原记录并结束本次交谈。');
  if(luckyInside(state))requireRule(payload.type==='LUCKY'&&payload.command.type==='CLOSE','先0行动结束事项，归还原件或沿原路返回。');
  if(machineInside(state))requireRule(payload.type==='MACHINE'&&payload.command.type==='CLOSE','先0行动停止练习并退开。');
  if(monsterInside(state))requireRule(payload.type==='MONSTER'&&payload.command.type==='CLOSE','先0行动结束注意并沿原路退开。');
  if(werewolfInside(state))requireRule(payload.type==='WEREWOLF'&&(state.werewolf.moon.pendingWeek!==null?payload.command.type==='HANDLE_MOON':payload.command.type==='RETURN'),'先实际度过月圆，或0行动返回原现场。');
  if(madmanInside(state))requireRule(payload.type==='MADMAN'&&payload.command.type==='STOP','先0行动实际停止本次练习。');
  if(prisonerInside(state))requireRule(payload.type==='PRISONER'&&payload.command.type==='RETURN','先0行动把同一原木撑交还哈伦。');
  if(serialKillerInside(state))requireRule(payload.type==='SERIAL_KILLER'&&payload.command.type==='CLOSE','先0行动实际关闭练习并退开。');
  if(unwingedInside(state))requireRule(payload.type==='UNWINGED'&&payload.command.type==='STAND_DOWN','先0行动实际停手退开，结束这次冲动。');
  if(criminalInside(state))requireRule(payload.type==='CRIMINAL'&&payload.command.type==='RETURN','先0行动把原工钱袋交还本人。');
  if(shadowAsceticInside(state))requireRule(payload.type==='SHADOW_ASCETIC'&&payload.command.type==='REVEAL','先0行动解除本次藏匿，沿原普通退路回到明处。');
  if(listenerInside(state))requireRule(payload.type==='LISTENER'&&payload.command.type==='LEAVE','先0行动沿原门退到约定外间，结束本次接触。');
  if(secretSupplicantInside(state))requireRule(payload.type==='SECRET_SUPPLICANT'&&payload.command.type==='COVER','先0行动把原罩盖回，结束本次接触。');
  if(wizardInside(state))requireRule(payload.type==='WIZARD'&&payload.command.type==='END','先0行动结束本次短时效果或撤下原遮板。');
  if(combatScholarInside(state))requireRule(payload.type==='COMBAT_SCHOLAR'&&payload.command.type==='STOP','先0行动实际停止本次演练。');
  if(pryerInside(state))requireRule(payload.type==='PRYER'&&payload.command.type==='CLOSE','先0行动实际合上原页，结束这次阅读。');
  if(instigatorInside(state))requireRule(payload.type==='INSTIGATOR'&&payload.command.type==='SETTLE','先0行动停止挑动并退开，结束本次谈话。');
  if(assassinInside(state))requireRule(payload.type==='ASSASSIN'&&payload.command.type==='RETURN','你还在原上层平台，先0行动沿真实楼梯或足额轻身返回。');
  if(gladiatorInside(state))requireRule(payload.type==='GLADIATOR'&&payload.command.type==='RELEASE','先0行动松手分开，结束本次实际接触。');
  if(apprenticeInside(state))requireRule(payload.type==='EVENT_CHOICE'||(payload.type==='ACTION'&&payload.action==='REST')||(payload.type==='APPRENTICE'&&payload.command.type==='RETURN'),'你仍在原门内，先用0行动沿已开的原门返回，再工作或处理外部事务。');
  if(state.tamer.companionId!==null)requireRule(payload.type==='TAMER'&&(payload.command.type==='ASSIST'||payload.command.type==='RETURN_ANIMAL'),'先完成本次动物协助，或0行动将原动物送回原主人，再处理其他行动。');
  if(payload.type==='TOWN'&&payload.command.type==='EQUIP_CLUB')requireRule(state.warrior.practiceClub.custodian!=='PLAYER','手中还有借用的原训练棍，先沿原路归还，再持自己的短棍。');
  if(payload.type==='TOWN'&&payload.command.type==='EQUIP_CLUB')requireRule(state.marauder.dispute.weapon.custodian!=='PLAYER','手中仍有塞蒙的原短棍，先到登记柜交存，再持自己的短棍。');
  if(payload.type==='CONTINUE_LIFE'){
    requireRule(state.status==='SLICE_COMPLETE'&&state.ending&&state.ending.kind!=='DEATH'&&state.caseArchive.length===0,'只有存活的首案角色可以继续生活。');
    const s=clone(state);s.caseArchive.push(clone(s.ending!));s.ending=null;s.status='ACTIVE';s.lastCheck=null;
    note(s,'首案之后，生活继续','原案卷、伤势、欠款和危险物去向均保留。你可以继续谋生休养，可以在自己的途径页继续实践和有限委托。');
    syncWerewolfMoon(s,seerContext(s));syncZombieMoon(s,seerContext(s));syncWraithMoon(s,seerContext(s));syncPuppetMoon(s,seerContext(s));if(!gladiatorInside(s)&&!assassinInside(s)&&!instigatorInside(s)&&!pryerInside(s)&&!combatScholarInside(s)&&!wizardInside(s)&&!secretSupplicantInside(s)&&!listenerInside(s)&&!shadowAsceticInside(s)&&!criminalInside(s)&&!unwingedInside(s)&&!serialKillerInside(s)&&!prisonerInside(s)&&!madmanInside(s)&&!werewolfInside(s)&&!monsterInside(s)&&!machineInside(s)&&!luckyInside(s)&&!lawyerInside(s)&&!barbarianInside(s)&&!briberInside(s)&&!arbiterInside(s)&&!sheriffInside(s)&&!interrogatorInside(s)&&!cultivatorInside(natureWalkerInheritedView(s))&&!physicianInside(natureWalkerInheritedView(s))&&!harvestpriestInside(natureWalkerInheritedView(s))&&!facelessInside(s)&&!conspiratorInside(s)&&!hypnotistInside(s)&&!artisanInside(s)&&!potionProfessorInside(s)&&!sootherInside(s)&&!polymathInside(s)&&!windBlessedInside(s)&&!notaryInside(s)&&!spiritGuideInside(s)&&!recorderInside(s)&&!fireThiefInside(s)&&!dawnPaladinInside(s)&&!pleasureInside(s)&&!scrollProfessorInside(s)&&!roseBishopInside(s)&&!demonInside(s)&&!zombieInside(s)&&!calamityPriestInside(s)&&!corruptionBaronInside(s)&&!judgeInside(s)&&!biologistInside(natureWalkerInheritedView(s))&&!marionettistInside(s)&&!reaperInside(s)&&!dreamwalkerInside(s)&&!astronomerInside(s)&&!crimsonScholarInside(s)&&!spiritWarlockInside(s)&&!mysticismMagisterInside(s)&&!oceanSingerInside(s)&&!priestOfLightInside(s)&&!gatekeeperInside(s)&&!travelerInside(s)&&!dreamStealerInside(s)&&!guardianInside(s)&&!painInside(s)&&!starMysticInside(s)&&!shepherdInside(s)&&!desireApostleInside(s)&&!wraithInside(s)&&!winnerInside(s)&&!mentorDisorderInside(s)&&!punishmentKnightInside(s)&&!druidInside(natureWalkerInheritedView(s))&&!bizarroInside(s)&&!hasBizarroRitualLock(s)&&!ironBloodInside(s)&&!hasIronBloodRitualLock(s)&&!isInsideIronBloodEncounter(s)&&!manipulatorInside(s)&&!hasManipulatorRitualLock(s)&&!isInsideManipulatorEncounter(s)&&!alchemistInside(s)&&!hasAlchemistRitualLock(s)&&!isInsideAlchemistEncounter(s)&&!witchKingInside(s)&&!hasWitchKingRitualLock(s)&&!isInsideWitchKingEncounter(s)&&!nightwatcherInside(s)&&!hasNightwatcherRitualLock(s)&&!isInsideNightwatcherEncounter(s)&&!prophetInside(s)&&!hasProphetRitualLock(s)&&!isInsideProphetEncounter(s)&&!cataclysmPriestInside(s)&&!hasCataclysmPriestRitualLock(s)&&!isInsideCataclysmPriestEncounter(s)&&!unshadowedInside(s)&&!hasUnshadowedRitualLock(s)&&!isInsideUnshadowedEncounter(s)&&!undyingInside(s)&&!hasUndyingRitualLock(s)&&!isInsideUndyingEncounter(s)&&!hasSecretsSorcererLifeLock(s)&&!hasSecretsSorcererRitualLock(s)&&!hasParasiteLifeLock(s)&&!hasParasiteEncounterLock(s)&&!hasDemonHunterLifeLock(s)&&!hasDemonHunterEncounterLock(s)&&!hasDespairLifeLock(s)&&!hasDespairEncounterLock(s)&&!hasMysticRitualLock(s)&&!hasMysticLifeLock(s)&&!hasMysticEncounterLock(s)&&!hasBlackKnightLifeLock(s)&&!hasBlackKnightEncounterLock(s)&&!hasDevilLifeLock(s)&&!hasDevilEncounterLock(s)&&!hasPuppetLifeLock(s)&&!hasPuppetEncounterLock(s)&&!hasMisfortuneMageLifeLock(s)&&!hasMisfortuneMageEncounterLock(s)&&!hasFallenEarlLifeLock(s)&&!hasFallenEarlEncounterLock(s)&&!hasImperativeMageLifeLock(s)&&!hasImperativeMageEncounterLock(s)&&!hasAncientAlchemistLifeLock(natureWalkerInheritedView(s))&&!hasAncientAlchemistEncounterLock(natureWalkerInheritedView(s)))processPulse(s);syncWerewolfMoon(s,seerContext(s));syncZombieMoon(s,seerContext(s));syncWraithMoon(s,seerContext(s));syncPuppetMoon(s,seerContext(s));if(s.week!==state.week&&s.magician.lantern.prepared){s.magician.lantern.prepared=false;note(s,'周末收妥油灯','原油灯随本次事务结束熄灭，已耗灯油不会恢复。');}s.revision=state.revision+1;return s;
  }
  requireRule(state.status==='ACTIVE','本次试玩已收尾，当前进度只供查看。');const s=clone(state);s.lastCheck=null;
  if(s.magician.lantern.prepared&&!state.combat&&payload.type!=='MAGICIAN'&&!(payload.type==='FACELESS'&&payload.command.type==='ENCOUNTER_FIGHT')&&!(payload.type==='BIZARRO_SORCERER'&&['START_RITUAL','START_CHALLENGE'].includes(payload.command.type))){s.magician.lantern.prepared=false;note(s,'收妥随身油灯','转去其他事务前熄灭原油灯，已耗灯油不退还。再次使用火焰法术需重新备灯。');}
  if(payload.type==='EVENT_CHOICE'){
    const e=currentEvent(s);requireRule(e&&e.instanceId===payload.eventInstanceId,'当前事件已经变化，请重新查看。');const choice=e!.choices.find(c=>c.id===payload.choiceId);requireRule(choice?.enabled,choice?.disabledReason??'这项选择当前不可用。');s.activeEvent=null;choose(s,payload.choiceId,e!.id);
  }else if(payload.type==='COMBAT_ROUND'){
    requireRule(s.combat&&!s.activeEvent,'当前没有可继续的战斗。');requireRule((s.progression.pathwayId!==null?['ATTACK','DEFEND','CONTROL','PREPARE','RETREAT']:['ATTACK','DEFEND','RETREAT']).includes(payload.stance),'当前普通人没有这种已定义的战术姿态。');
    requireRule(payload.puppetCurse===undefined||(typeof payload.puppetCurse==='boolean'&&s.progression.pathwayId==='chained'&&((s.progression.sequence===4&&s.combat?.encounterId==='PUPPET_DISPUTE')||(s.progression.sequence===3&&s.combat?.encounterId==='SILENT_DISCIPLE_DISPUTE')||(s.progression.sequence===2&&s.combat?.encounterId==='ANCIENT_EVIL_DISPUTE')||(s.progression.sequence===1&&s.combat?.encounterId==='ABOMINATION_DISPUTE'))),'伤己联系策略只供当前木偶、沉默门徒、古代邪物或神孽真实交战。');
    requireRule(payload.recordingId===undefined||(s.progression.pathwayId==='door'&&s.progression.sequence===6),'记录释放选择仅供记录官。');
    requireRule(payload.winnerPolicy===undefined||((payload.winnerPolicy==='HOLD'||payload.winnerPolicy==='SPEND_FIRST')&&s.progression.pathwayId==='wheel'&&(s.progression.sequence===5||(s.progression.sequence===4&&s.combat?.encounterId==='MISFORTUNE_MAGE_DISPUTE')||(s.progression.sequence===3&&s.combat?.encounterId==='CHAOS_WALKER_DISPUTE')||(s.progression.sequence===2&&s.combat?.encounterId==='FATE_PROPHET_DISPUTE')||(s.progression.sequence===1&&s.combat?.encounterId==='MERCURY_SNAKE_DISPUTE'))),'幸运储备策略只供赢家本回合明确选择。');
    requireRule(payload.madmanPolicy===undefined||((payload.madmanPolicy==='HOLD'||payload.madmanPolicy==='BURST_FIRST')&&s.progression.pathwayId==='chained'&&(s.progression.sequence===8||s.progression.sequence===7||s.progression.sequence===6||s.progression.sequence===5||s.progression.sequence===4||(s.progression.sequence===3&&s.combat?.encounterId==='SILENT_DISCIPLE_DISPUTE')||(s.progression.sequence===2&&s.combat?.encounterId==='ANCIENT_EVIL_DISPUTE')||(s.progression.sequence===1&&s.combat?.encounterId==='ABOMINATION_DISPUTE'))),'短时强化策略只供疯子本回合明确选择。');
    requireRule(payload.ragePolicy===undefined||((payload.ragePolicy==='HOLD'||payload.ragePolicy==='RELEASE_FIRST')&&s.progression.pathwayId==='tyrant'&&(s.progression.sequence===8||s.progression.sequence===7||s.progression.sequence===6)),'怒击策略仅供已知怒意爆发的暴君途径本回合选择。');
    if(Object.hasOwn(payload,'shepherdSpiritId')){requireRule(s.progression.pathwayId==='hanged-man'&&(s.progression.sequence===5||s.progression.sequence===4||s.progression.sequence===3),'先掌握放牧能力。');activateShepherdSpirit(s,payload.shepherdSpiritId??null,seerContext(s));}
    const encounterId=s.combat!.encounterId;const result=resolveSliceCombatRound(s,payload.stance,payload.ragePolicy??'HOLD',payload.madmanPolicy??'HOLD',payload.recordingId??null,payload.winnerPolicy??'HOLD',payload.ironBloodPolicy??'HOLD',payload.puppetCurse??false,payload.warBishopPolicy??'HOLD');s.combatHistory.push(clone(result.round));note(s,`${encounterId==='NATURE_WALKER_DISPUTE'?'自然行者邻侧苗圃交战':encounterId==='HAND_OF_ORDER_DISPUTE'?'秩序之手邻侧分场交战':encounterId==='PRINCE_OF_ABOLITION_DISPUTE'?'弑序亲王承接区邻院交战':encounterId==='MERCURY_SNAKE_DISPUTE'?'水银之蛇工房邻院交战':encounterId==='ABOMINATION_DISPUTE'?'神孽安静室邻院交战':encounterId==='UNCLEAN_MONARCH_DISPUTE'?'污秽君王安静室邻院交战':encounterId==='DARK_ANGEL_DISPUTE'?'暗天使封存院外交战':encounterId==='KNOWLEDGE_EMPEROR_DISPUTE'?'知识皇帝阅览院交战':encounterId==='APOCALYPSE_DEMONESS_DISPUTE'?'末日魔女画廊附室外交战':encounterId==='DIVINE_HAND_DISPUTE'?'神明之手修整室外交战':encounterId==='TIME_WORM_DISPUTE'?'时之虫登记室外交战':encounterId==='STAR_KEY_DISPUTE'?'星之匙通行室外交战':encounterId==='PALE_EMPEROR_DISPUTE'?'苍白皇帝附廊交战':encounterId==='CIVILIZATION_ENLIGHTENER_DISPUTE'?'文明启蒙者工院交战':encounterId==='WRITER_DISPUTE'?'作家原石坪交战':encounterId==='FATE_PROPHET_DISPUTE'?'先知原机械工房交战':encounterId==='ANCIENT_EVIL_DISPUTE'?'古代邪物原安静房交战':encounterId==='BLOOD_DUKE_DISPUTE'?'鲜血大公原安静房交战':encounterId==='ELDER_DISPUTE'?'秽语长老原庭院交战':encounterId==='SAGE_DISPUTE'?'贤者档馆外院交战':encounterId==='CALAMITY_DEMONESS_DISPUTE'?'灾难魔女镜廊外院交战':encounterId==='GLORY_DISPUTE'?'荣耀者修整室外院交战':encounterId==='FATE_TROJAN_DISPUTE'?'命运木马登记所庭院交战':encounterId==='PLANESWALKER_DISPUTE'?'星途接待场交战':encounterId==='DEATH_CONSUL_DISPUTE'?'两室交战':encounterId==='LIGHT_SEEKER_DISPUTE'?'采光廊交战':encounterId==='CATASTROPHE_DISPUTE'?'天灾原小湾交战':encounterId==='WISDOM_ANGEL_DISPUTE'?'智慧天使候选原资料庭交战':encounterId==='CONCEALMENT_SERVANT_DISPUTE'?'隐秘之仆候选原门庭交战':encounterId==='LIFE_GIVER_DISPUTE'?'创生者原小院交战':encounterId==='KNOWLEDGE_MENTOR_DISPUTE'?'知识导师候选原工院交战':encounterId==='DISCERNER_DISPUTE'?'洞察者原核验院交战':encounterId==='WEATHER_WARLOCK_DISPUTE'?'天气术士原蓄水院交战':encounterId==='MIRACLE_WORKER_DISPUTE'?'奇迹师原石场交战':encounterId==='COFFIN_BEARER_DISPUTE'?'抬棺人原庭院交战':encounterId==='CHAOS_HUNTER_DISPUTE'?'混乱猎手原庭院交战':encounterId==='FRENZY_MAGE_DISPUTE'?'狂乱法师原庭院交战':encounterId==='CHAOS_WALKER_DISPUTE'?'候选混乱行者原庭院交战':encounterId==='SILENT_DISCIPLE_DISPUTE'?'沉默门徒原庭院交战':encounterId==='BLATHERER_COURT'?'呓语者原附院交战':encounterId==='THREE_HEADED_TEMPLAR_DISPUTE'?'三首圣堂原附院交战':encounterId==='PROPHECY_MASTER_DISPUTE'?'预言大师原附院交战':encounterId==='UNAGING_DEMONESS_DISPUTE'?'不老魔女原镜小院交战':encounterId==='SILVER_KNIGHT_HUNT'?'本人亲猎原强生物':encounterId==='SILVER_KNIGHT_DISPUTE'?'银骑士原院交战':encounterId==='DECEIT_MENTOR_DISPUTE'?'欺瞒导师原工作院交战':encounterId==='WANDERER_DISPUTE'?'漫游者原工作院交战':encounterId==='FERRYMAN_DISPUTE'?'摆渡人原工作院交战':encounterId==='JUSTICE_MENTOR_DISPUTE'?'正义导师原工作院交战':encounterId==='SEA_KING_DISPUTE'?'海王原码头交战':encounterId==='INSIGHT_SCHOLAR_DISPUTE'?'洞悉者候选G原库庭交战':encounterId==='FEAR_BISHOP_DISPUTE'?'恐惧主教原库庭交战':encounterId==='SUMMONING_MASTER_DISPUTE'?'召唤大师原工坊石院交战':encounterId==='ARCANE_SCHOLAR_DISPUTE'?'奥秘学者原工坊石院交战':encounterId==='DREAM_WEAVER_DISPUTE'?'织梦人原阅览处外院交战':encounterId==='WAR_BISHOP_DISPUTE'?'战争主教原队石院交战':encounterId==='ANCIENT_SCHOLAR_DISPUTE'?'古代学者后世原院交战':encounterId==='ANCIENT_ALCHEMIST_DISPUTE'?'古代炼金师原院交战':encounterId==='IMPERATIVE_MAGE_DISPUTE'?'律令法师原院交战':encounterId==='FALLEN_EARL_DISPUTE'?'堕落伯爵原院交战':encounterId==='MISFORTUNE_MAGE_DISPUTE'?'厄运法师原院交战':encounterId==='PUPPET_DISPUTE'?'木偶原院交战':encounterId==='DEVIL_DISPUTE'?'魔鬼原院交战':encounterId==='BLACK_KNIGHT_DISPUTE'?'黑骑士原院交战':encounterId==='MYSTIC_DISPUTE'?'神秘学家原院交战':encounterId==='DESPAIR_DISPUTE'?'绝望魔女原院交战':encounterId==='DEMON_HUNTER_DISPUTE'?'猎魔者原守卫交战':encounterId==='PARASITE_DISPUTE'?'原庭院能力争夺':encounterId==='SECRETS_SORCERER_RITUAL'?'原石拱敌意封印':encounterId==='UNDYING_DISPUTE'?'原纪念馆石庭冲突':encounterId==='UNSHADOWED_DISPUTE'?'原石礼堂院冲突':encounterId==='CATACLYSM_PRIEST_DISPUTE'?'原岸边石院冲突':encounterId==='PROPHET_DISPUTE'?'原档案院冲突':encounterId==='NIGHTWATCHER_DISPUTE'?'原值夜院冲突':encounterId==='WITCH_KING_DISPUTE'?'原夜间小院冲突':encounterId==='ALCHEMIST_DISPUTE'?'原工房院落冲突':encounterId==='MANIPULATOR_DISPUTE'?'原仓院心灵冲突':encounterId==='IRON_BLOOD_DISPUTE'?'原石院铁血冲突':encounterId==='BIZARRO_RITUAL'?'原钟舞台真实冲突':encounterId==='DRUID_DISPUTE'?'原外院冲突':encounterId==='PUNISHMENT_KNIGHT_DISPUTE'?'原外院冲突':encounterId==='MENTOR_DISORDER_DISPUTE'?'原外院冲突':encounterId==='WINNER_DISPUTE'?'原外院冲突':encounterId==='WRAITH_DISPUTE'?'原外院冲突':encounterId==='DESIRE_APOSTLE_DISPUTE'?'原外院冲突':encounterId==='SHEPHERD_DISPUTE'?'原外院冲突':encounterId==='STAR_MYSTIC_DISPUTE'?'原外院冲突':encounterId==='PAIN_DISPUTE'?'原外院冲突':encounterId==='GUARDIAN_DISPUTE'?'原外院冲突':encounterId==='DREAM_STEALER_DISPUTE'?'原纸箱房冲突':encounterId==='TRAVELER_DISPUTE'?'原货房冲突':encounterId==='GATEKEEPER_DISPUTE'?'原纪念院冲突':encounterId==='PRIEST_OF_LIGHT_DISPUTE'?'原小院冲突':encounterId==='OCEAN_SINGER_DISPUTE'?'原码头工院冲突':encounterId==='MYSTICISM_MAGISTER_DISPUTE'?'原工院冲突':encounterId==='SPIRIT_WARLOCK_DISPUTE'?'原树院冲突':encounterId==='CRIMSON_SCHOLAR_DISPUTE'?'原月光院冲突':encounterId==='ASTRONOMER_DISPUTE'?'原观测院冲突':encounterId==='DREAMWALKER_DISPUTE'?'原后院冲突':encounterId==='REAPER_DISPUTE'?'原石院冲突':encounterId==='MARIONETTIST_DISPUTE'?'原前院多恩冲突':encounterId==='BIOLOGIST_DISPUTE'?'原温室外院冲突':encounterId==='JUDGE_DISPUTE'?'原调解处外院冲突':encounterId==='CORRUPTION_BARON_DISPUTE'?'原契约铺外院冲突':encounterId==='CALAMITY_PRIEST_DISPUTE'?'原报时铺外院冲突':encounterId==='ZOMBIE_DISPUTE'?'原工坊外院冲突':encounterId==='DEMON_DISPUTE'?'原练习间外院冲突':encounterId==='ROSE_BISHOP_DISPUTE'?'原血肉练习间外院冲突':encounterId==='SCROLL_PROFESSOR_DISPUTE'?'原卷轴工房外院冲突':encounterId==='PLEASURE_DISPUTE'?'原练习间外院冲突':encounterId==='DAWN_PALADIN_DISPUTE'?'原练习场冲突':encounterId==='FIRE_THIEF_DISPUTE'?'教学室外院冲突':encounterId==='RECORDER_DISPUTE'?'教学室外院冲突':encounterId==='SPIRIT_GUIDE_DISPUTE'?'纪念室外院冲突':encounterId==='NOTARY_DISPUTE'?'工房外院冲突':encounterId==='WIND_BLESSED_DISPUTE'?'维修院冲突':encounterId==='POLYMATH_DISPUTE'?'教学室外院冲突':encounterId==='SOOTHER_DISPUTE'?'外院冲突':encounterId==='POTION_PROFESSOR_DISPUTE'?'药房冲突':encounterId==='ARTISAN_DISPUTE'?'工房冲突':'追击'}第${result.round.round}回合`,result.round.consequence);
    if(result.outcome!=='CONTINUE')s.magician.lantern.prepared=false;
    if(result.outcome==='ENEMY_SEALED'){requireRule(encounterId==='SECRETS_SORCERER_RITUAL','封印结果必须来自当前秘法师真实战场。');settleSecretsSorcererRitual(s,result.outcome,seerContext(s));awardSeerMastery(s,'secrets-seal:'+s.week+':'+s.revision,25,seerContext(s));}
    else if(encounterId==='SECRETS_SORCERER_RITUAL'){settleSecretsSorcererRitual(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='SILVER_KNIGHT_HUNT'||encounterId==='SILVER_KNIGHT_DISPUTE'){settleSilverKnightEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='COFFIN_BEARER_DISPUTE'){settleCoffinBearerEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='CHAOS_HUNTER_DISPUTE'){settleChaosHunterEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='FRENZY_MAGE_DISPUTE'){settleFrenzyMageEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='CHAOS_WALKER_DISPUTE'){settleChaosWalkerEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='SILENT_DISCIPLE_DISPUTE'){settleSilentDiscipleEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='BLATHERER_COURT'){settleBlathererEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='THREE_HEADED_TEMPLAR_DISPUTE'){settleThreeHeadedTemplarEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='PROPHECY_MASTER_DISPUTE'){settleProphecyMasterEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='UNAGING_DEMONESS_DISPUTE'){settleUnagingDemonessEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='DECEIT_MENTOR_DISPUTE'){settleDeceitMentorEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='WANDERER_DISPUTE'){settleWandererEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='FERRYMAN_DISPUTE'){settleFerrymanEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='JUSTICE_MENTOR_DISPUTE'){settleJusticeMentorEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='SEA_KING_DISPUTE'){settleSeaKingEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='INSIGHT_SCHOLAR_DISPUTE'){settleInsightScholarEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='FEAR_BISHOP_DISPUTE'){settleFearBishopEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='SUMMONING_MASTER_DISPUTE'){settleSummoningMasterEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='ARCANE_SCHOLAR_DISPUTE'){settleArcaneScholarEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='DREAM_WEAVER_DISPUTE'){settleDreamWeaverEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='WAR_BISHOP_DISPUTE'){settleWarBishopEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='PALE_EMPEROR_DISPUTE'){settlePaleEmperorEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='PURE_WHITE_ANGEL_DISPUTE'){settlePureWhiteAngelEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='THUNDER_GOD_DISPUTE'){settleThunderGodEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='NATURE_WALKER_DISPUTE'){settleNatureWalkerEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='HAND_OF_ORDER_DISPUTE'){settleHandOfOrderEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='PRINCE_OF_ABOLITION_DISPUTE'){settlePrinceOfAbolitionEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='MERCURY_SNAKE_DISPUTE'){settleMercurySnakeEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='ABOMINATION_DISPUTE'){settleAbominationEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='UNCLEAN_MONARCH_DISPUTE'){settleUncleanMonarchEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='DARK_ANGEL_DISPUTE'){settleDarkAngelEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='KNOWLEDGE_EMPEROR_DISPUTE'){settleKnowledgeEmperorEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='APOCALYPSE_DEMONESS_DISPUTE'){settleApocalypseDemonessEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='DIVINE_HAND_DISPUTE'){settleDivineHandEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='TIME_WORM_DISPUTE'){settleTimeWormEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='STAR_KEY_DISPUTE'){settleStarKeyEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='ALL_KNOWING_EYE_DISPUTE'){settleAllKnowingEyeEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='MISFORTUNE_KNIGHT_DISPUTE'){settleMisfortuneKnightEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='BEAUTY_GODDESS_DISPUTE'){settleBeautyGoddessEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='CIVILIZATION_ENLIGHTENER_DISPUTE'){settleCivilizationEnlightenerEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='WRITER_DISPUTE'){settleWriterEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='CONQUEROR_DISPUTE'){settleConquerorEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='ATTENDANT_MYSTERIES_DISPUTE'){settleAttendantMysteriesEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='BARREN_MATRIARCH_DISPUTE'){settleBarrenMatriarchEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='BALANCER_DISPUTE'){settleBalancerEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='ENTROPY_DUKE_DISPUTE'){settleEntropyDukeEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='FATE_PROPHET_DISPUTE'){settleFateProphetEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='ANCIENT_EVIL_DISPUTE'){settleAncientEvilEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='BLOOD_DUKE_DISPUTE'){settleBloodDukeEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='ELDER_DISPUTE'){settleElderEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='SAGE_DISPUTE'){settleSageEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='CALAMITY_DEMONESS_DISPUTE'){settleCalamityDemonessEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='GLORY_DISPUTE'){settleGloryEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='FATE_TROJAN_DISPUTE'){settleFateTrojanEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='PLANESWALKER_DISPUTE'){settlePlaneswalkerEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='DEATH_CONSUL_DISPUTE'){settleDeathConsulEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='LIGHT_SEEKER_DISPUTE'){settleLightSeekerEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='CATASTROPHE_DISPUTE'){settleCatastropheEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='WISDOM_ANGEL_DISPUTE'){settleWisdomAngelEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='CONCEALMENT_SERVANT_DISPUTE'){settleConcealmentServantEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='LIFE_GIVER_DISPUTE'){settleLifeGiverEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='KNOWLEDGE_MENTOR_DISPUTE'){settleKnowledgeMentorEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='DISCERNER_DISPUTE'){settleDiscernerEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='WEATHER_WARLOCK_DISPUTE'){settleWeatherWarlockEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='MIRACLE_WORKER_DISPUTE'){settleMiracleWorkerEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD'&&!openMiracleWorkerRevival(s,seerContext(s)))finish(s,'DEATH');}
    else if(encounterId==='ANCIENT_SCHOLAR_DISPUTE'){settleAncientScholarEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='ANCIENT_ALCHEMIST_DISPUTE'){settleAncientAlchemistEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='IMPERATIVE_MAGE_DISPUTE'){settleImperativeMageEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='FALLEN_EARL_DISPUTE'){settleFallenEarlEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='MISFORTUNE_MAGE_DISPUTE'){settleMisfortuneMageEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='PUPPET_DISPUTE'){settlePuppetEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='DEVIL_DISPUTE'){settleDevilEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='BLACK_KNIGHT_DISPUTE'){settleBlackKnightEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='MYSTIC_DISPUTE'){settleMysticEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='DESPAIR_DISPUTE'){settleDespairEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='DEMON_HUNTER_DISPUTE'){settleDemonHunterEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='PARASITE_DISPUTE'){settleParasiteEncounter(s,result.outcome,seerContext(s));if(result.outcome==='ENEMY_DEAD'||result.outcome==='ENEMY_SURRENDERED')awardSeerMastery(s,'parasite:'+s.week+':'+s.revision,25,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='MARAUDER_DISPUTE'){settleMarauderDispute(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='NIGHTMARE_DISPUTE'){settleNightmareEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='MIDNIGHT_DISPUTE'){settleMidnightEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='SLEEPLESS_WATCH'){settleSleeplessEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='VAMPIRE_DISPUTE'){settleVampireEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='PSYCHOLOGIST_DISPUTE'){settlePsychologistEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='PYROMANIAC_DISPUTE'){settlePyromaniacEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='UNDYING_DISPUTE'){settleUndyingEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');else if(result.outcome==='ENEMY_DEAD'||result.outcome==='ENEMY_SURRENDERED')awardSeerMastery(s,'undying-combat-victory:'+s.week+':'+s.revision,25,seerContext(s));}
    else if(encounterId==='UNSHADOWED_DISPUTE'){settleUnshadowedEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');else if(result.outcome==='ENEMY_DEAD'||result.outcome==='ENEMY_SURRENDERED')awardSeerMastery(s,'unshadowed-combat-victory:'+s.week+':'+s.revision,25,seerContext(s));}
    else if(encounterId==='CATACLYSM_PRIEST_DISPUTE'){settleCataclysmPriestEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');else if(result.outcome==='ENEMY_DEAD'||result.outcome==='ENEMY_SURRENDERED')awardSeerMastery(s,'cataclysmPriest-combat-victory:'+s.week+':'+s.revision,25,seerContext(s));}
    else if(encounterId==='PROPHET_DISPUTE'){settleProphetEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');else if(result.outcome==='ENEMY_DEAD'||result.outcome==='ENEMY_SURRENDERED')awardSeerMastery(s,'prophet-combat-victory:'+s.week+':'+s.revision,25,seerContext(s));}
    else if(encounterId==='NIGHTWATCHER_DISPUTE'){settleNightwatcherEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');else if(result.outcome==='ENEMY_DEAD'||result.outcome==='ENEMY_SURRENDERED')awardSeerMastery(s,'nightwatcher-combat-victory:'+s.week+':'+s.revision,25,seerContext(s));}
    else if(encounterId==='WITCH_KING_DISPUTE'){settleWitchKingEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');else if(result.outcome==='ENEMY_DEAD'||result.outcome==='ENEMY_SURRENDERED')awardSeerMastery(s,'witch-king-combat-victory:'+s.week+':'+s.revision,25,seerContext(s));}
    else if(encounterId==='ALCHEMIST_DISPUTE'){settleAlchemistEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');else if(result.outcome==='ENEMY_DEAD'||result.outcome==='ENEMY_SURRENDERED')awardSeerMastery(s,'alchemist-combat-victory:'+s.week+':'+s.revision,25,seerContext(s));}
    else if(encounterId==='MANIPULATOR_DISPUTE'){settleManipulatorEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');else if(result.outcome==='ENEMY_DEAD'||result.outcome==='ENEMY_SURRENDERED')awardSeerMastery(s,'manipulator-combat-victory:'+s.week+':'+s.revision,25,seerContext(s));}
    else if(encounterId==='IRON_BLOOD_DISPUTE'){settleIronBloodEncounter(s,result.outcome,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');else if(result.outcome==='ENEMY_DEAD'||result.outcome==='ENEMY_SURRENDERED')awardSeerMastery(s,'iron-blood-combat-victory:'+s.week+':'+s.revision,25,seerContext(s));}
    else if(encounterId==='BIZARRO_RITUAL'){settleBizarroRitual(s,result.outcome,seerContext(s));if(result.outcome==='ENEMY_DEAD')awardSeerMastery(s,'bizarro-ritual-victory:'+s.bizarroSorcerer.ritual.attemptId,25,seerContext(s));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='DRUID_DISPUTE'){settleDruidEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='PUNISHMENT_KNIGHT_DISPUTE'){settlePunishmentKnightEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='MENTOR_DISORDER_DISPUTE'){settleMentorDisorderEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='WINNER_DISPUTE'){settleWinnerEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='WRAITH_DISPUTE'){settleWraithEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='DESIRE_APOSTLE_DISPUTE'){settleDesireApostleEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='SHEPHERD_DISPUTE'){settleShepherdEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='STAR_MYSTIC_DISPUTE'){settleStarMysticEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='PAIN_DISPUTE'){settlePainEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='GUARDIAN_DISPUTE'){settleGuardianEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='DREAM_STEALER_DISPUTE'){settleDreamStealerEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='TRAVELER_DISPUTE'){settleTravelerEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='GATEKEEPER_DISPUTE'){settleGatekeeperEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='PRIEST_OF_LIGHT_DISPUTE'){settlePriestOfLightEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='OCEAN_SINGER_DISPUTE'){settleOceanSingerEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='MYSTICISM_MAGISTER_DISPUTE'){settleMysticismMagisterEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='SPIRIT_WARLOCK_DISPUTE'){settleSpiritWarlockEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='CRIMSON_SCHOLAR_DISPUTE'){settleCrimsonScholarEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='ASTRONOMER_DISPUTE'){settleAstronomerEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='DREAMWALKER_DISPUTE'){settleDreamwalkerEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='REAPER_DISPUTE'){settleReaperEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='MARIONETTIST_DISPUTE'){settleMarionettistEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='BIOLOGIST_DISPUTE'){settleBiologistEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='JUDGE_DISPUTE'){settleJudgeEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='CORRUPTION_BARON_DISPUTE'){settleCorruptionBaronEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='CALAMITY_PRIEST_DISPUTE'){settleCalamityPriestEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='ZOMBIE_DISPUTE'){settleZombieEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='DEMON_DISPUTE'){settleDemonEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='ROSE_BISHOP_DISPUTE'){settleRoseBishopEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='SCROLL_PROFESSOR_DISPUTE'){settleScrollProfessorEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='PLEASURE_DISPUTE'){settlePleasureEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='DAWN_PALADIN_DISPUTE'){settleDawnPaladinEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='FIRE_THIEF_DISPUTE'){settleFireThiefEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='RECORDER_DISPUTE'){settleRecorderEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='SPIRIT_GUIDE_DISPUTE'){settleSpiritGuideEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='NOTARY_DISPUTE'){settleNotaryEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='WIND_BLESSED_DISPUTE'){settleWindBlessedEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='POLYMATH_DISPUTE'){settlePolymathEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='SOOTHER_DISPUTE'){settleSootherEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='POTION_PROFESSOR_DISPUTE'){settlePotionProfessorEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='ARTISAN_DISPUTE'){settleArtisanEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='HYPNOTIST_DISPUTE'){settleHypnotistEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='CONSPIRATOR_DISPUTE'){settleConspiratorEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='FACELESS_DISPUTE'){settleFacelessEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');}
    else if(encounterId==='MAGICIAN_DISPUTE'){
      settleMagicianEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));
      if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');
    }else if(encounterId==='PROVOKER_DISPUTE'){
      settleProvokerEncounter(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));
      if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');
    }else if(encounterId==='HUNTER_CARGO'){
      settleHunterCargo(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));
      if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');
    }else if(encounterId==='CLOWN_RESCUE'){
      settleClownRescue(s,result.outcome,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));
      if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');
    }
    else if(result.outcome==='PLAYER_DEAD')finish(s,'DEATH');
    else if(result.outcome!=='CONTINUE'){
      if(result.outcome==='ENEMY_DEAD'){s.world.carrierAlive=false;s.world.carrierCanResist=false;}
      if(result.outcome==='ENEMY_SURRENDERED')s.world.carrierCanResist=false;
      if(s.progression.pathwayId!==null&&s.combatHistory.some(r=>r.retreat==='NONE'&&r.moves.some(m=>m.actor==='PLAYER'&&(m.selfGain>0||m.enemyReduction>0)))){awardSeerMastery(s,'first-case-combat',25,seerContext(s));if(s.progression.pathwayId==='hunter')s.progression.acting=Math.min(100,s.progression.acting+16);}
      const secured=result.outcome==='ENEMY_DEAD'||result.outcome==='ENEMY_SURRENDERED';
      setAxes(s,'SOME_SAVED',s.arc.fullCrossLedger?'PARTIAL_EVIDENCE':'COVERED_UP',secured?'SECURED_TEMPORARILY':'ESCAPED_WITH_CARRIER');s.combat=null;finishScene(s);
    }
  }else{
    requireRule(!s.activeEvent&&!s.combat,'先处理当前事件或战斗。');
    if(payload.type==='TOWN'){try{applyTownCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行这项物品操作。');}}
    else if(payload.type==='ANCIENT_ALCHEMIST'){try{applyAncientAlchemistCommand(s,payload.command,seerContext(s));if(s.health===0)finish(s,'DEATH');}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行古代炼金师行动。');}}
    else if(payload.type==='IMPERATIVE_MAGE'){try{applyImperativeMageCommand(s,payload.command,seerContext(s));if(s.health===0)finish(s,'DEATH');}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行律令法师行动。');}}
    else if(payload.type==='FALLEN_EARL'){try{applyFallenEarlCommand(s,payload.command,seerContext(s));if(s.health===0)finish(s,'DEATH');}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行堕落伯爵行动。');}}
    else if(payload.type==='MISFORTUNE_MAGE'){try{applyMisfortuneMageCommand(s,payload.command,seerContext(s));if(s.health===0)finish(s,'DEATH');}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行厄运法师行动。');}}
    else if(payload.type==='PUPPET'){try{applyPuppetCommand(s,payload.command,seerContext(s));if(s.health===0)finish(s,'DEATH');}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行木偶行动。');}}
    else if(payload.type==='DEVIL'){try{applyDevilCommand(s,payload.command,seerContext(s));if(s.health===0)finish(s,'DEATH');}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行魔鬼行动。');}}
    else if(payload.type==='BLACK_KNIGHT'){try{applyBlackKnightCommand(s,payload.command,seerContext(s));if(s.health===0)finish(s,'DEATH');}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行黑骑士行动。');}}
    else if(payload.type==='MYSTIC'){try{applyMysticCommand(s,payload.command,seerContext(s));if(s.health===0)finish(s,'DEATH');}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行神秘学家行动。');}}
    else if(payload.type==='DESPAIR'){try{applyDespairCommand(s,payload.command,seerContext(s));if(s.health===0)finish(s,'DEATH');}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行绝望魔女行动。');}}
    else if(payload.type==='DEMON_HUNTER'){try{applyDemonHunterCommand(s,payload.command,seerContext(s));if(s.health===0)finish(s,'DEATH');}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行猎魔者行动。');}}
    else if(payload.type==='PARASITE'){try{applyParasiteCommand(s,payload.command,seerContext(s));if(s.health===0)finish(s,'DEATH');}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行寄生者行动。');}}
    else if(payload.type==='SECRETS_SORCERER'){try{applySecretsSorcererCommand(s,payload.command,seerContext(s));if(s.health===0)finish(s,'DEATH');}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行秘法师行动。');}}
    else if(payload.type==='UNDYING'){try{if(isUndyingActivityCommand(payload.command))applyUndyingActivity(s,payload.command,seerContext(s));else applyUndyingCommand(s,payload.command,seerContext(s));if(s.health===0)finish(s,'DEATH');}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行不死者行动。');}}
    else if(payload.type==='UNSHADOWED'){try{if(isUnshadowedActivityCommand(payload.command))applyUnshadowedActivity(s,payload.command,seerContext(s));else applyUnshadowedCommand(s,payload.command,seerContext(s));if(s.health===0)finish(s,'DEATH');}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行无暗者行动。');}}
    else if(payload.type==='CATACLYSM_PRIEST'){try{if(isCataclysmPriestActivityCommand(payload.command))applyCataclysmPriestActivity(s,payload.command,seerContext(s));else applyCataclysmPriestCommand(s,payload.command,seerContext(s));if(s.health===0)finish(s,'DEATH');}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行灾难主祭行动。');}}
    else if(payload.type==='PROPHET'){try{if(isProphetActivityCommand(payload.command))applyProphetActivity(s,payload.command,seerContext(s));else applyProphetCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行预言家行动。');}}
    else if(payload.type==='NIGHTWATCHER'){try{if(isNightwatcherActivityCommand(payload.command))applyNightwatcherActivity(s,payload.command,seerContext(s));else applyNightwatcherCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行守夜人行动。');}}
    else if(payload.type==='WITCH_KING'){try{if(isWitchKingActivity(payload.command))applyWitchKingActivity(s,payload.command,seerContext(s));else applyWitchKingCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行巫王行动。');}}
    else if(payload.type==='ALCHEMIST'){try{if(isAlchemistActivity(payload.command))applyAlchemistActivity(s,payload.command,seerContext(s));else applyAlchemistCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行炼金术士行动。');}}
    else if(payload.type==='MANIPULATOR'){try{if(isManipulatorActivity(payload.command))applyManipulatorActivity(s,payload.command,seerContext(s));else applyManipulatorCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行操纵师行动。');}}
    else if(payload.type==='COFFIN_BEARER'){try{applyCoffinBearerCommand(s,payload.command,seerContext(s));if(s.health<=0)finish(s,'DEATH');}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行抬棺人行动。');}}
    else if(payload.type==='CHAOS_HUNTER'){try{applyChaosHunterCommand(s,payload.command,seerContext(s));if(s.health<=0)finish(s,'DEATH');}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行混乱猎手行动。');}}
    else if(payload.type==='FRENZY_MAGE'){try{applyFrenzyMageCommand(s,payload.command,seerContext(s));if(s.health<=0)finish(s,'DEATH');}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行狂乱法师行动。');}}
    else if(payload.type==='CHAOS_WALKER'){try{applyChaosWalkerCommand(s,payload.command,seerContext(s));if(s.health<=0)finish(s,'DEATH');}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行混乱行者行动。');}}
    else if(payload.type==='SILENT_DISCIPLE'){try{applySilentDiscipleCommand(s,payload.command,seerContext(s));if(s.health<=0)finish(s,'DEATH');}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行沉默门徒行动。');}}
    else if(payload.type==='BLATHERER'){try{applyBlathererCommand(s,payload.command,seerContext(s));if(s.health<=0)finish(s,'DEATH');}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行呓语者行动。');}}
    else if(payload.type==='THREE_HEADED_TEMPLAR'){try{applyThreeHeadedTemplarCommand(s,payload.command,seerContext(s));if(s.health<=0)finish(s,'DEATH');}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行三首圣堂行动。');}}
    else if(payload.type==='PROPHECY_MASTER'){try{applyProphecyMasterCommand(s,payload.command,seerContext(s));if(s.health<=0)finish(s,'DEATH');}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行预言大师行动。');}}
    else if(payload.type==='UNAGING_DEMONESS'){try{applyUnagingDemonessCommand(s,payload.command,seerContext(s));if(s.health<=0)finish(s,'DEATH');}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行不老魔女行动。');}}
    else if(payload.type==='SILVER_KNIGHT'){try{applySilverKnightCommand(s,payload.command,seerContext(s));if(s.health<=0)finish(s,'DEATH');}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行银骑士行动。');}}
    else if(payload.type==='DECEIT_MENTOR'){try{applyDeceitMentorCommand(s,payload.command,seerContext(s));if(s.health<=0)finish(s,'DEATH');}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行欺瞒导师行动。');}}
    else if(payload.type==='WANDERER'){try{applyWandererCommand(s,payload.command,seerContext(s));if(s.health<=0)finish(s,'DEATH');}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行漫游者行动。');}}
    else if(payload.type==='JUSTICE_MENTOR'){try{applyJusticeMentorCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行正义导师行动。');}}
    else if(payload.type==='SEA_KING'){try{applySeaKingCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行海王行动。');}}
    else if(payload.type==='INSIGHT_SCHOLAR'){try{applyInsightScholarCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行洞悉者候选G行动。');}}
    else if(payload.type==='FEAR_BISHOP'){try{applyFearBishopCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行恐惧主教行动。');}}
    else if(payload.type==='SUMMONING_MASTER'){try{applySummoningMasterCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行召唤大师行动。');}}
    else if(payload.type==='ARCANE_SCHOLAR'){try{applyArcaneScholarCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行奥秘学者行动。');}}
    else if(payload.type==='DREAM_WEAVER'){try{applyDreamWeaverCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行织梦人行动。');}}
      else if(payload.type==='PLANESWALKER'){try{applyPlaneswalkerCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行旅法师行动。');}}
  else if(payload.type==='PURE_WHITE_ANGEL'){try{applyPureWhiteAngelCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行纯白天使行动。');}}
  else if(payload.type==='THUNDER_GOD'){try{applyThunderGodCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行雷神行动。');}}
  else if(payload.type==='NATURE_WALKER'){try{applyNatureWalkerCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行自然行者行动。');}}
  else if(payload.type==='HAND_OF_ORDER'){try{applyHandOfOrderCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行秩序之手行动。');}}
  else if(payload.type==='PRINCE_OF_ABOLITION'){try{applyPrinceOfAbolitionCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行弑序亲王行动。');}}
  else if(payload.type==='MERCURY_SNAKE'){try{applyMercurySnakeCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行水银之蛇行动。');}}
  else if(payload.type==='ABOMINATION'){try{applyAbominationCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行神孽行动。');}}
  else if(payload.type==='UNCLEAN_MONARCH'){try{applyUncleanMonarchCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行污秽君王行动。');}}
  else if(payload.type==='DARK_ANGEL'){try{applyDarkAngelCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行暗天使行动。');}}
  else if(payload.type==='KNOWLEDGE_EMPEROR'){try{applyKnowledgeEmperorCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行知识皇帝行动。');}}
  else if(payload.type==='APOCALYPSE_DEMONESS'){try{applyApocalypseDemonessCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行末日魔女行动。');}}
  else if(payload.type==='DIVINE_HAND'){try{applyDivineHandCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行神明之手行动。');}}
  else if(payload.type==='TIME_WORM'){try{applyTimeWormCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行时之虫行动。');}}
  else if(payload.type==='STAR_KEY'){try{applyStarKeyCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行星之匙行动。');}}
  else if(payload.type==='ALL_KNOWING_EYE'){try{applyAllKnowingEyeCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行全知之眼行动。');}}
  else if(payload.type==='MISFORTUNE_KNIGHT'){try{applyMisfortuneKnightCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行厄难骑士行动。');}}
  else if(payload.type==='BEAUTY_GODDESS'){try{applyBeautyGoddessCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行美神行动。');}}
  else if(payload.type==='CIVILIZATION_ENLIGHTENER'){try{applyCivilizationEnlightenerCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行文明启蒙者行动。');}}
  else if(payload.type==='WRITER'){try{applyWriterCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行作家行动。');}}
  else if(payload.type==='CONQUEROR'){try{applyConquerorCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行征服者行动。');}}
  else if(payload.type==='BARREN_MATRIARCH'){try{applyBarrenMatriarchCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行荒芜主母行动。');}}
  else if(payload.type==='BALANCER'){try{applyBalancerCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行平衡者行动。');}}
  else if(payload.type==='ENTROPY_DUKE'){try{applyEntropyDukeCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行熵之公爵行动。');}}
  else if(payload.type==='FATE_PROPHET'){try{applyFateProphetCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行先知行动。');}}
  else if(payload.type==='ANCIENT_EVIL'){try{applyAncientEvilCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行古代邪物行动。');}}
  else if(payload.type==='BLOOD_DUKE'){try{applyBloodDukeCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行鲜血大公行动。');}}
  else if(payload.type==='ELDER'){try{applyElderCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行秽语长老行动。');}}
  else if(payload.type==='SAGE'){try{applySageCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行贤者行动。');}}
  else if(payload.type==='CALAMITY_DEMONESS'){try{applyCalamityDemonessCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行灾难魔女行动。');}}
  else if(payload.type==='GLORY'){try{applyGloryCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行荣耀者行动。');}}
  else if(payload.type==='FATE_TROJAN'){try{applyFateTrojanCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行命运木马行动。');}}
  else if(payload.type==='LIGHT_SEEKER'){try{applyLightSeekerCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行逐光者行动。');}}
    else if(payload.type==='CATASTROPHE'){try{applyCatastropheCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行天灾行动。');}}
    else if(payload.type==='WISDOM_ANGEL'){try{applyWisdomAngelCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行智慧天使候选行动。');}}
    else if(payload.type==='CONCEALMENT_SERVANT'){try{applyConcealmentServantCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行隐秘之仆候选行动。');}}
    else if(payload.type==='LIFE_GIVER'){try{applyLifeGiverCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行创生者行动。');}}
    else if(payload.type==='KNOWLEDGE_MENTOR'){try{applyKnowledgeMentorCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行知识导师候选行动。');}}
    else if(payload.type==='DISCERNER'){try{applyDiscernerCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行洞察者行动。');}}
    else if(payload.type==='WEATHER_WARLOCK'){try{applyWeatherWarlockCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行天气术士行动。');}}
    else if(payload.type==='WAR_BISHOP'){try{applyWarBishopCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行战争主教行动。');}}
    else if(payload.type==='IRON_BLOOD_KNIGHT'){try{if(isIronBloodActivity(payload.command))applyIronBloodActivity(s,payload.command,seerContext(s));else applyIronBloodKnightCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行铁血骑士行动。');}}
    else if(payload.type==='BIZARRO_SORCERER'){try{if(isBizarroActivity(payload.command))applyBizarroActivity(s,payload.command,seerContext(s));else applyBizarroSorcererCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行诡法师行动。');}}
    else if(payload.type==='DRUID'){try{if(isDruidActivity(payload.command))applyDruidActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyDruidCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行德鲁伊行动。');}}
    else if(payload.type==='PUNISHMENT_KNIGHT'){try{if(isPunishmentKnightActivity(payload.command))applyPunishmentKnightActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyPunishmentKnightCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行惩戒骑士行动。');}}
    else if(payload.type==='MENTOR_DISORDER'){try{if(isMentorDisorderActivity(payload.command))applyMentorDisorderActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyMentorDisorderCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行混乱导师行动。');}}
    else if(payload.type==='WINNER'){try{if(isWinnerActivity(payload.command))applyWinnerActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyWinnerCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行赢家行动。');}}
    else if(payload.type==='WRAITH'){try{if(isWraithActivity(payload.command))applyWraithActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyWraithCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行怨魂行动。');}}
    else if(payload.type==='DESIRE_APOSTLE'){try{if(isDesireApostleActivity(payload.command))applyDesireApostleActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyDesireApostleCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行欲望使徒行动。');}}
    else if(payload.type==='SHEPHERD'){try{if(isShepherdActivity(payload.command))applyShepherdActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyShepherdCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行牧羊人行动。');}}
    else if(payload.type==='STAR_MYSTIC'){try{if(isStarMysticActivity(payload.command))applyStarMysticActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyStarMysticCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行星象师行动。');}}
    else if(payload.type==='PAIN'){try{if(isPainActivity(payload.command))applyPainActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyPainCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行痛苦魔女行动。');}}
    else if(payload.type==='GUARDIAN'){try{if(isGuardianActivity(payload.command))applyGuardianActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyGuardianCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行守护者行动。');}}
    else if(payload.type==='DREAM_STEALER'){try{if(isDreamStealerActivity(payload.command))applyDreamStealerActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyDreamStealerCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行窃梦家行动。');}}
    else if(payload.type==='TRAVELER'){try{if(isTravelerActivity(payload.command))applyTravelerActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyTravelerCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行旅行家行动。');}}
    else if(payload.type==='GATEKEEPER'){try{if(isGatekeeperActivity(payload.command))applyGatekeeperActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyGatekeeperCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行看门人行动。');}}
    else if(payload.type==='PRIEST_OF_LIGHT'){try{if(isPriestOfLightActivity(payload.command))applyPriestOfLightActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyPriestOfLightCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行光之祭司行动。');}}
    else if(payload.type==='OCEAN_SINGER'){try{if(isOceanSingerActivity(payload.command))applyOceanSingerActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyOceanSingerCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行海洋歌者行动。');}}
    else if(payload.type==='MYSTICISM_MAGISTER'){try{if(isMysticismMagisterActivity(payload.command))applyMysticismMagisterActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyMysticismMagisterCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行秘术导师行动。');}}
    else if(payload.type==='SPIRIT_WARLOCK'){try{if(isSpiritWarlockActivity(payload.command))applySpiritWarlockActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applySpiritWarlockCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行灵巫行动。');}}
    else if(payload.type==='CRIMSON_SCHOLAR'){try{if(isCrimsonScholarActivity(payload.command))applyCrimsonScholarActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyCrimsonScholarCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行深红学者行动。');}}
    else if(payload.type==='ASTRONOMER'){try{if(isAstronomerActivity(payload.command))applyAstronomerActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyAstronomerCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行天文学家行动。');}}
    else if(payload.type==='DREAMWALKER'){try{if(isDreamwalkerActivity(payload.command))applyDreamwalkerActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyDreamwalkerCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行梦境行者行动。');}}
    else if(payload.type==='REAPER'){try{if(isReaperActivity(payload.command))applyReaperActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyReaperCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行收割者行动。');}}
    else if(payload.type==='MARIONETTIST'){try{if(isMarionettistAcquisitionCommand(payload.command))applyMarionettistAcquisition(s,payload.command,seerContext(s));else applyMarionettistActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行秘偶大师行动。');}}
    else if(payload.type==='BIOLOGIST'){try{if(isBiologistActivity(payload.command))applyBiologistActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyBiologistCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行生物学家行动。');}}
    else if(payload.type==='JUDGE'){try{if(isJudgeActivity(payload.command))applyJudgeActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyJudgeCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行法官行动。');}}
    else if(payload.type==='CORRUPTION_BARON'){try{if(isCorruptionBaronActivity(payload.command))applyCorruptionBaronActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyCorruptionBaronCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行腐化男爵行动。');}}
    else if(payload.type==='CALAMITY_PRIEST'){try{if(isCalamityPriestActivity(payload.command))applyCalamityPriestActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyCalamityPriestCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行灾祸教士行动。');}}
    else if(payload.type==='ZOMBIE'){try{if(isZombieActivity(payload.command))applyZombieActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyZombieCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行活尸行动。');}}
    else if(payload.type==='DEMON'){try{if(isDemonActivity(payload.command))applyDemonActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyDemonCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行恶魔行动。');}}
    else if(payload.type==='ROSE_BISHOP'){try{if(isRoseBishopActivity(payload.command))applyRoseBishopActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyRoseBishopCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行蔷薇主教行动。');}}
    else if(payload.type==='SCROLL_PROFESSOR'){try{if(isScrollProfessorActivity(payload.command))applyScrollProfessorActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyScrollProfessorCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行卷轴教授行动。');}}
    else if(payload.type==='PLEASURE'){try{if(isPleasureActivity(payload.command))applyPleasureActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyPleasureCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行欢愉魔女行动。');}}
    else if(payload.type==='DAWN_PALADIN'){try{if(isDawnPaladinActivity(payload.command))applyDawnPaladinActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyDawnPaladinCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行黎明骑士行动。');}}
    else if(payload.type==='FIRE_THIEF'){try{if(isFireThiefActivity(payload.command))applyFireThiefActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyFireThiefCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行盗火人行动。');}}
    else if(payload.type==='RECORDER'){try{if(isRecorderActivity(payload.command))applyRecorderActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyRecorderCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行记录官行动。');}}
    else if(payload.type==='SPIRIT_GUIDE'){try{if(isSpiritGuideActivity(payload.command))applySpiritGuideActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applySpiritGuideCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行死灵导师行动。');}}
    else if(payload.type==='NOTARY'){try{if(isNotaryActivity(payload.command))applyNotaryActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyNotaryCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行公证人行动。');}}
    else if(payload.type==='WIND_BLESSED'){try{if(isWindBlessedActivity(payload.command))applyWindBlessedActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyWindBlessedCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行风眷者行动。');}}
    else if(payload.type==='POLYMATH'){try{if(isPolymathActivity(payload.command))applyPolymathActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyPolymathCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行博学者行动。');}}
    else if(payload.type==='SOOTHER'){try{if(isSootherActivity(payload.command))applySootherActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applySootherCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行安魂师行动。');}}
    else if(payload.type==='POTION_PROFESSOR'){try{if(isPotionProfessorActivity(payload.command))applyPotionProfessorActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyPotionProfessorCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行魔药教授行动。');}}
    else if(payload.type==='ARTISAN'){try{if(isArtisanActivity(payload.command))applyArtisanActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyArtisanCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行工匠行动。');}}
    else if(payload.type==='HYPNOTIST'){try{if(isHypnotistActivity(payload.command))applyHypnotistActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyHypnotistCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行催眠师行动。');}}
    else if(payload.type==='CONSPIRATOR'){try{if(isConspiratorActivity(payload.command))applyConspiratorActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyConspiratorCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行阴谋家行动。');}}
    else if(payload.type==='FACELESS'){try{if(isFacelessAcquisitionCommand(payload.command))applyFacelessAcquisition(s,payload.command,seerContext(s));else applyFacelessActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行无面人行动。');}}
    else if(payload.type==='HARVESTPRIEST'){try{if(isHarvestpriestActivity(payload.command))applyHarvestpriestActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyHarvestpriestCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行丰收祭司行动。');}}
    else if(payload.type==='PHYSICIAN'){try{if(isPhysicianActivity(payload.command))applyPhysicianActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyPhysicianCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行医师行动。');}}
    else if(payload.type==='CULTIVATOR'){try{if(isCultivatorActivity(payload.command))applyCultivatorActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyCultivatorCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行耕种者行动。');}}
    else if(payload.type==='INTERROGATOR'){try{if(isInterrogatorActivity(payload.command))applyInterrogatorActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyInterrogatorCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行审讯者行动。');}}
    else if(payload.type==='SHERIFF'){try{if(isSheriffActivity(payload.command))applySheriffActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applySheriffCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行治安官行动。');}}
    else if(payload.type==='ARBITER'){try{if(isArbiterActivity(payload.command))applyArbiterActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyArbiterCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行仲裁人行动。');}}
    else if(payload.type==='BRIBER'){try{if(isBriberActivity(payload.command))applyBriberActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyBriberCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行贿赂者行动。');}}
    else if(payload.type==='BARBARIAN'){try{if(isBarbarianActivity(payload.command))applyBarbarianActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyBarbarianCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行野蛮人行动。');}}
    else if(payload.type==='LAWYER'){try{if(isLawyerActivity(payload.command))applyLawyerActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyLawyerCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行律师行动。');}}
    else if(payload.type==='LUCKY'){try{if(isLuckyActivity(payload.command))applyLuckyActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyLuckyCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行幸运者行动。');}}
    else if(payload.type==='MACHINE'){try{if(isMachineActivity(payload.command))applyMachineActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyMachineCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行机器行动。');}}
    else if(payload.type==='MONSTER'){try{if(isMonsterActivity(payload.command))applyMonsterActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyMonsterCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行怪物行动。');}}
    else if(payload.type==='WEREWOLF'){try{if(isWerewolfActivity(payload.command))applyWerewolfActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyWerewolfCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行狼人行动。');}}
    else if(payload.type==='MADMAN'){try{if(isMadmanActivity(payload.command))applyMadmanActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyMadmanCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行疯子行动。');}}
    else if(payload.type==='PRISONER'){try{if(isPrisonerActivity(payload.command))applyPrisonerActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyPrisonerCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行囚犯行动。');}}
    else if(payload.type==='SERIAL_KILLER'){try{if(isSerialKillerActivity(payload.command))applySerialKillerActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applySerialKillerCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行连环杀手行动。');}}
    else if(payload.type==='UNWINGED'){try{if(isUnwingedActivity(payload.command))applyUnwingedActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyUnwingedCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行折翼天使行动。');}}
    else if(payload.type==='CRIMINAL'){try{if(isCriminalActivity(payload.command))applyCriminalActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyCriminalCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行罪犯行动。');}}
    else if(payload.type==='SHADOW_ASCETIC'){try{if(isShadowAsceticActivity(payload.command))applyShadowAsceticActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyShadowAsceticCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行隐修士行动。');}}
    else if(payload.type==='LISTENER'){try{if(isListenerActivity(payload.command))applyListenerActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyListenerCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行倾听者行动。');}}
    else if(payload.type==='SECRET_SUPPLICANT'){try{if(isSecretSupplicantActivity(payload.command))applySecretSupplicantActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applySecretSupplicantCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行秘祈人行动。');}}
    else if(payload.type==='WIZARD'){try{if(isWizardActivity(payload.command))applyWizardActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyWizardCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行巫师行动。');}}
    else if(payload.type==='COMBAT_SCHOLAR'){try{if(isCombatScholarActivity(payload.command))applyCombatScholarActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyCombatScholarCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行格斗学者行动。');}}
    else if(payload.type==='PRYER'){try{if(isPryerActivity(payload.command))applyPryerActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyPryerCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行窥秘人行动。');}}
    else if(payload.type==='WITCH'){try{if(isWitchActivity(payload.command))applyWitchActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyWitchCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行女巫行动。');}}
    else if(payload.type==='INSTIGATOR'){try{if(isInstigatorActivity(payload.command))applyInstigatorActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyInstigatorCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行教唆者行动。');}}
    else if(payload.type==='ASSASSIN'){try{if(isAssassinActivity(payload.command))applyAssassinActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyAssassinCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行刺客行动。');}}
    else if(payload.type==='WEAPONMASTER'){try{if(payload.command.type==='RETURN_TOOL')applyWarriorActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else if(isWeaponmasterActivity(payload.command))applyWeaponmasterActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyWeaponmasterCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行武器大师行动。');}}
    else if(payload.type==='GLADIATOR'){try{if(payload.command.type==='RETURN_TOOL')applyWarriorActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else if(isGladiatorActivity(payload.command))applyGladiatorActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyGladiatorCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行格斗家行动。');}}
    else if(payload.type==='WARRIOR'){try{if(isWarriorActivity(payload.command))applyWarriorActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyWarriorCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行战士行动。');}}
    else if(payload.type==='CRYPTOLOGIST'){try{if(payload.command.type==='RETURN_TOOL')applyMarauderDispute(s,payload.command,seerContext(s));else if(isCryptologistActivity(payload.command))applyCryptologistActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyCryptologistCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行解密学者行动。');}}
    else if(payload.type==='SWINDLER'){try{if(payload.command.type==='RETURN_TOOL')applyMarauderDispute(s,payload.command,seerContext(s));else if(isSwindlerActivity(payload.command))applySwindlerActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applySwindlerCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行诈骗师行动。');}}
    else if(payload.type==='MARAUDER'){try{if(isMarauderDisputeCommand(payload.command))applyMarauderDispute(s,payload.command,seerContext(s));else if(isMarauderActivity(payload.command))applyMarauderActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyMarauderCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行偷盗者行动。');}}
    else if(payload.type==='ASTROLOGER'){try{if(isAstrologerActivity(payload.command))applyAstrologerActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyAstrologerCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行占星人行动。');}}
    else if(payload.type==='TRICKMASTER'){try{if(isTrickmasterActivity(payload.command))applyTrickmasterActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyTrickmasterCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行戏法大师行动。');}}
    else if(payload.type==='APPRENTICE'){try{if(isApprenticeActivity(payload.command))applyApprenticeActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyApprenticeCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行学徒行动。');}}
    else if(payload.type==='SPIRITMEDIUM'){try{if(isSpiritmediumActivity(payload.command))applySpiritmediumActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applySpiritmediumCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行通灵者行动。');}}
    else if(payload.type==='GRAVEDIGGER'){try{if(isGravediggerActivity(payload.command))applyGravediggerActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyGravediggerCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行掘墓人行动。');}}
    else if(payload.type==='CORPSECOLLECTOR'){try{if(isCorpsecollectorActivity(payload.command))applyCorpsecollectorActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyCorpsecollectorCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行收尸人行动。');}}
    else if(payload.type==='SUNPRIEST'){try{if(isSunpriestActivity(payload.command))applySunpriestActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applySunpriestCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行太阳神官行动。');}}
    else if(payload.type==='LIGHTPRAYER'){try{if(isLightprayerActivity(payload.command))applyLightprayerActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyLightprayerCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行祈光人行动。');}}
    else if(payload.type==='BARD'){try{if(isBardActivity(payload.command))applyBardActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyBardCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行歌颂者行动。');}}
    else if(payload.type==='NAVIGATOR'){try{if(isNavigatorActivity(payload.command))applyNavigatorActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyNavigatorCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行航海家行动。');}}
    else if(payload.type==='RAGER'){try{if(isRagerActivity(payload.command))applyRagerActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyRagerCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行暴怒之民行动。');}}
    else if(payload.type==='SAILOR'){try{if(isSailorActivity(payload.command))applySailorActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applySailorCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行水手行动。');}}
    else if(payload.type==='DETECTIVE'){try{if(isDetectiveActivity(payload.command))applyDetectiveActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyDetectiveCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行守知者行动。');}}
    else if(payload.type==='REASONER'){try{if(isReasonerActivity(payload.command))applyReasonerActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyReasonerCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行推理学员行动。');}}
    else if(payload.type==='READER'){try{if(isReaderActivity(payload.command))applyReaderActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyReaderCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行阅读者行动。');}}
    else if(payload.type==='NIGHTMARE'){try{if(isNightmareActivity(payload.command))applyNightmareActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyNightmareCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行梦魇行动。');}}
    else if(payload.type==='MIDNIGHT'){try{if(isMidnightActivity(payload.command))applyMidnightActivity(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyMidnightCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行午夜诗人行动。');}}
    else if(payload.type==='SLEEPLESS'){try{if(isSleeplessActivity(payload.command))applySleeplessWatch(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applySleeplessCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行不眠者行动。');}}
    else if(payload.type==='VAMPIRE'){try{if(isVampireActivity(payload.command))applyVampireLife(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyVampireCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行吸血鬼行动。');}}
    else if(payload.type==='APPRAISER'){try{if(isAppraiserActivity(payload.command))applyAppraiserPractice(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyAppraiserCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行鉴定师行动。');}}
    else if(payload.type==='PSYCHOLOGIST'){try{if(isPsychologistActivity(payload.command))applyPsychologistSocial(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyPsychologistCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行心理医生行动。');}}
    else if(payload.type==='PYROMANIAC'){try{if(isPyromaniacActivity(payload.command))applyPyromaniacPractice(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyPyromaniacCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行纵火家行动。');}}
    else if(payload.type==='MAGICIAN'){try{if(isMagicianActivity(payload.command))applyMagicianPractice(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyMagicianCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行魔术师行动。');}}
    else if(payload.type==='TAMER'){try{if(isTamerAnimals(payload.command))applyTamerAnimals(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyTamerCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行这项驯兽行动。');}}
    else if(payload.type==='APOTHECARY'){try{if(isApothecaryClinic(payload.command))applyApothecaryClinic(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyApothecaryCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行这项护理。');}}
    else if(payload.type==='ARCHAEOLOGIST'){try{if(isArchaeologistExploration(payload.command))applyArchaeologistExploration(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyArchaeologistCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行这项考察。');}}
    else if(payload.type==='SAVANT'){try{if(isSavantCraft(payload.command))applySavantCraft(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applySavantCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行这项工坊行动。');}}
    else if(payload.type==='MINDREADER'){try{if(payload.command.type==='OBSERVE'||payload.command.type==='READ'||payload.command.type==='DISCUSS'||payload.command.type==='REFLECT')applyMindreaderSocial(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyMindreaderCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行这项读心者行动。');}}
    else if(payload.type==='AUDIENCE'){try{if(payload.command.type==='OBSERVE'||payload.command.type==='DISCUSS'||payload.command.type==='REFLECT')applyAudienceSocial(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyAudienceCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行这项观众行动。');}}
    else if(payload.type==='PROVOKER'){try{if(payload.command.type==='OBSERVE'||payload.command.type==='CHOOSE'||payload.command.type==='REFLECT'||payload.command.type==='ENCOUNTER_TALK'||payload.command.type==='ENCOUNTER_FIGHT')applyProvokerAdventure(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyProvokerCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行这项挑衅者行动。');}}
    else if(payload.type==='HUNTER'){try{if(payload.command.type==='PRACTICE'||payload.command.type==='REFLECT'||payload.command.type==='SET_TRAP'||payload.command.type==='RECOVER_TRAP'||payload.command.type==='CARGO_TALK'||payload.command.type==='CARGO_FIGHT')applyHunterAdventure(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyHunterCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行这项猎人行动。');}}
    else if(payload.type==='CLOWN'){try{if(payload.command.type==='PRACTICE'||payload.command.type==='RESCUE_TALK'||payload.command.type==='RESCUE_FIGHT')applyClownAdventure(s,payload.command,seerContext(s),(source,amount)=>awardSeerMastery(s,source,amount,seerContext(s)));else applyClownCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:'当前不能进行这项小丑行动。');}}
    else if(payload.type==='SEER'){const oldOmen=s.seer.omen;try{applySeerCommand(s,payload.command,seerContext(s));}catch(error){throw new SliceRuleError(error instanceof Error?error.message:"这项成长操作当前不可用。");}if(payload.command.type==='DIVINE'&&s.seer.omen!==oldOmen&&s.seer.omen&&!oldOmen)s.progression.acting=Math.min(100,s.progression.acting+12);}
    else if(payload.type==='SET_LIFESTYLE'){s.nextLifeTier=payload.tier;note(s,'下周生活安排',`已申请下周使用${SLICE_LIFE[payload.tier].label}档，本周费用与恢复不变。`);}
    else if(payload.type==='REPAY'){requireRule(Number.isSafeInteger(payload.amount)&&payload.amount>0&&payload.amount<=s.cash&&payload.amount<=debtTotal(s),'还款金额须为现款及欠款范围内的正整数。');repay(s,payload.amount);note(s,'提前偿还',`实际偿还${payload.amount}便士。`);}
    else if(payload.type==='CANCEL_AID'){requireRule(s.aid==='ACCEPTED'||s.aid==='CORRECT','当前没有可取消的援助委托。');s.aid='CANCELLED';s.aidInjuryIds=[];note(s,'取消援助委托','没有完成交付，不兑现处置，不退还已花行动。');}
    else{
      requireRule(s.actionsRemaining>0,'本周行动已用完，先结清周末待办。');
      if(payload.action==='INVESTIGATE'&&payload.targetId.startsWith('CARE-WORK')&&(s.aid==='ACCEPTED'||s.aid==='CORRECT')){
        const valid=s.world.city==='BACKLUND'&&s.world.careAvailable&&s.world.aidBatchAvailable&&s.aidInjuryIds.some(id=>s.injuries.some(i=>i.id===id&&i.treatedRevision===null));
        if(!valid){s.aid='CANCELLED';s.aidInjuryIds=[];note(s,'援助委托已失效','原批次、接触渠道或待治伤势已改变，取消未交付交换；不扣新行动、不赠处置。');s.revision=state.revision+1;return s;}
      }
      if(payload.action!=='REST')requireRule(s.health>0&&s.mind>0,'目前无法完成这项行动，请先休养。');
      if(payload.action==='LEARN')requireRule(learnTargets(s).some(t=>t.id===payload.targetId),'该学习主题不存在或已完成，不扣行动。');
      if(payload.action==='INVESTIGATE'){
        requireRule(investigationTargets(s).some(t=>t.id===payload.targetId),'暂无可核验的这个目标，不扣行动。');
        if(payload.targetId.startsWith('CARE-WORK'))requireRule(s.world.careAvailable&&s.world.aidBatchAvailable&&s.aidInjuryIds.some(id=>s.injuries.some(i=>i.id===id&&i.treatedRevision===null)),'这批援助委托已无法兑现，可以取消。');
      }
      s.actionsRemaining-=1;
      if(payload.action==='WORK'){const amount=s.wagePaidWeek===s.week?0:s.character.weeklyWage;s.cash+=amount;s.wagePaidWeek=s.week;note(s,'完成工作',amount?`本周职业工资${amount}便士已入账。`:'本周工资已经结算，本次没有重复入账。');}
      else if(payload.action==='REST')rest(s);
      else if(payload.action==='LEARN'){const occult=payload.targetId==='learn.seer-notes',t=occult?{id:'learn.seer-notes',label:'整理已学占卜笔记'}:SLICE_LEARNING_TOPICS.find(x=>x.id===payload.targetId)!;const r=check(s,'knowledge',occult?9:s.progression.pathwayId==='paragon'?10:12),before=s.character.coreStats.knowledge;if(success(r.tier))s.character.coreStats.knowledge=Math.max(before,Math.min(s.progression.pathwayId==='paragon'?30:20,before+1+s.character.learningBonus+(occult?2:0)));if(success(r.tier)){s.completedTopics.push(t.id);if(s.progression.pathwayId==='paragon')awardSeerMastery(s,`savant-study:${t.id}`,5,seerContext(s));if(occult){awardSeerMastery(s,'seer-notes-study',5,seerContext(s));s.progression.acting=Math.min(100,s.progression.acting+8);}}knowledge(s,t.label,success(r.tier)?`已经理解这份普通材料，知识${before}→${s.character.coreStats.knowledge}。`:'留下本次阅读记录，但尚未理解；知识没有增长。');}
      else if(payload.action==='INVESTIGATE') investigate(s,payload.targetId);
    }
  }
  syncWerewolfMoon(s,seerContext(s));syncZombieMoon(s,seerContext(s));syncWraithMoon(s,seerContext(s));syncPuppetMoon(s,seerContext(s));if(!gladiatorInside(s)&&!assassinInside(s)&&!instigatorInside(s)&&!pryerInside(s)&&!combatScholarInside(s)&&!wizardInside(s)&&!secretSupplicantInside(s)&&!listenerInside(s)&&!shadowAsceticInside(s)&&!criminalInside(s)&&!unwingedInside(s)&&!serialKillerInside(s)&&!prisonerInside(s)&&!madmanInside(s)&&!werewolfInside(s)&&!monsterInside(s)&&!machineInside(s)&&!luckyInside(s)&&!lawyerInside(s)&&!barbarianInside(s)&&!briberInside(s)&&!arbiterInside(s)&&!sheriffInside(s)&&!interrogatorInside(s)&&!cultivatorInside(natureWalkerInheritedView(s))&&!physicianInside(natureWalkerInheritedView(s))&&!harvestpriestInside(natureWalkerInheritedView(s))&&!facelessInside(s)&&!conspiratorInside(s)&&!hypnotistInside(s)&&!artisanInside(s)&&!potionProfessorInside(s)&&!sootherInside(s)&&!polymathInside(s)&&!windBlessedInside(s)&&!notaryInside(s)&&!spiritGuideInside(s)&&!recorderInside(s)&&!fireThiefInside(s)&&!dawnPaladinInside(s)&&!pleasureInside(s)&&!scrollProfessorInside(s)&&!roseBishopInside(s)&&!demonInside(s)&&!zombieInside(s)&&!calamityPriestInside(s)&&!corruptionBaronInside(s)&&!judgeInside(s)&&!biologistInside(natureWalkerInheritedView(s))&&!marionettistInside(s)&&!reaperInside(s)&&!dreamwalkerInside(s)&&!astronomerInside(s)&&!crimsonScholarInside(s)&&!spiritWarlockInside(s)&&!mysticismMagisterInside(s)&&!oceanSingerInside(s)&&!priestOfLightInside(s)&&!gatekeeperInside(s)&&!travelerInside(s)&&!dreamStealerInside(s)&&!guardianInside(s)&&!painInside(s)&&!starMysticInside(s)&&!shepherdInside(s)&&!desireApostleInside(s)&&!wraithInside(s)&&!winnerInside(s)&&!mentorDisorderInside(s)&&!punishmentKnightInside(s)&&!druidInside(natureWalkerInheritedView(s))&&!bizarroInside(s)&&!hasBizarroRitualLock(s)&&!ironBloodInside(s)&&!hasIronBloodRitualLock(s)&&!isInsideIronBloodEncounter(s)&&!manipulatorInside(s)&&!hasManipulatorRitualLock(s)&&!isInsideManipulatorEncounter(s)&&!alchemistInside(s)&&!hasAlchemistRitualLock(s)&&!isInsideAlchemistEncounter(s)&&!witchKingInside(s)&&!hasWitchKingRitualLock(s)&&!isInsideWitchKingEncounter(s)&&!nightwatcherInside(s)&&!hasNightwatcherRitualLock(s)&&!isInsideNightwatcherEncounter(s)&&!prophetInside(s)&&!hasProphetRitualLock(s)&&!isInsideProphetEncounter(s)&&!cataclysmPriestInside(s)&&!hasCataclysmPriestRitualLock(s)&&!isInsideCataclysmPriestEncounter(s)&&!unshadowedInside(s)&&!hasUnshadowedRitualLock(s)&&!isInsideUnshadowedEncounter(s)&&!undyingInside(s)&&!hasUndyingRitualLock(s)&&!isInsideUndyingEncounter(s)&&!hasSecretsSorcererLifeLock(s)&&!hasSecretsSorcererRitualLock(s)&&!hasParasiteLifeLock(s)&&!hasParasiteEncounterLock(s)&&!hasDemonHunterLifeLock(s)&&!hasDemonHunterEncounterLock(s)&&!hasDespairLifeLock(s)&&!hasDespairEncounterLock(s)&&!hasMysticRitualLock(s)&&!hasMysticLifeLock(s)&&!hasMysticEncounterLock(s)&&!hasBlackKnightLifeLock(s)&&!hasBlackKnightEncounterLock(s)&&!hasDevilLifeLock(s)&&!hasDevilEncounterLock(s)&&!hasPuppetLifeLock(s)&&!hasPuppetEncounterLock(s)&&!hasMisfortuneMageLifeLock(s)&&!hasMisfortuneMageEncounterLock(s)&&!hasFallenEarlLifeLock(s)&&!hasFallenEarlEncounterLock(s)&&!hasImperativeMageLifeLock(s)&&!hasImperativeMageEncounterLock(s)&&!hasAncientAlchemistLifeLock(natureWalkerInheritedView(s))&&!hasAncientAlchemistEncounterLock(natureWalkerInheritedView(s)))processPulse(s);syncWerewolfMoon(s,seerContext(s));syncZombieMoon(s,seerContext(s));syncWraithMoon(s,seerContext(s));syncPuppetMoon(s,seerContext(s));if(s.week!==state.week&&s.magician.lantern.prepared){s.magician.lantern.prepared=false;note(s,'周末收妥油灯','原油灯随本次事务结束熄灭，已耗灯油不会恢复。');}s.revision=state.revision+1;return s;
}
export function projectSliceState(s:SliceState):SliceProjection{
  return projectSliceStateCurrent(s,projectFool(s),hasFoolHistory(s),projectRedPriest(s),hasRedPriestHistory(s),projectVisionary(s),hasVisionaryHistory(s),projectPerfecter(s),hasPerfecterHistory(s),projectMoon(s),hasMoonHistory(s),projectDarkness(s),hasDarknessHistory(s),projectWhiteTower(s),hasWhiteTowerHistory(s));
}
function projectSliceStateCurrent(s:SliceState,fool:FoolProjection,hasCurrentFoolHistory:boolean,redPriest:RedPriestProjection,hasCurrentRedPriestHistory:boolean,visionary:VisionaryProjection,hasCurrentVisionaryHistory:boolean,perfecter:PerfecterProjection,hasCurrentPerfecterHistory:boolean,moon:MoonProjection,hasCurrentMoonHistory:boolean,darkness:DarknessProjection,hasCurrentDarknessHistory:boolean,whiteTower:WhiteTowerProjection,hasCurrentWhiteTowerHistory:boolean,tyrant:TyrantProjection=projectTyrant(s),hasCurrentTyrantHistory:boolean=hasTyrantHistory(s),sun:SunProjection=projectSun(s),hasCurrentSunHistory:boolean=hasSunHistory(s),death:DeathProjection=projectDeath(s),hasCurrentDeathHistory:boolean=hasDeathHistory(s),door:DoorProjection=projectDoor(s),hasCurrentDoorHistory:boolean=hasDoorHistory(s),errorAscent:ErrorAscentProjection=projectErrorAscent(s),hasCurrentErrorAscentHistory:boolean=hasErrorAscentHistory(s)):SliceProjection{
  const errorS1ProjectionView=s.errorAscent.source?errorAscentSourceView(s,s.errorAscent.source):s;
  const errorProjectionView=s.errorAscent.source?timeWormInheritedView(errorS1ProjectionView):s;
  const doorS1ProjectionView=s.door.source?doorSourceView(s,s.door.source):s;
  const doorProjectionView=s.door.source?starKeyInheritedView(doorS1ProjectionView):s;
  const deathS1ProjectionView=s.death.source?deathSourceView(s,s.death.source):s;
  const sunS1ProjectionView=s.sun.source?sunSourceView(s,s.sun.source):s;
  const tyrantS1ProjectionView=s.tyrant.source?tyrantSourceView(s,s.tyrant.source):s;
  const whiteTowerS1ProjectionView=s.whiteTower.source?whiteTowerSourceView(s,s.whiteTower.source):s;
  const darknessS1ProjectionView=s.darkness.source?darknessSourceView(s,s.darkness.source):s;
  const moonS1ProjectionView=s.moon.source?moonSourceView(s,s.moon.source):s;
  const paragonS1ProjectionView=s.perfecter.source?perfecterSourceView(s,s.perfecter.source):s;
  const paragonProjectionView=civilizationEnlightenerInheritedView(paragonS1ProjectionView);
  const audienceProjectionView=s.visionary.source?visionarySourceView(s,s.visionary.source):s;
  const hunterProjectionView=s.redPriest.source?redPriestSourceView(s,s.redPriest.source):s;
  const divinerProjectionView=s.fool.source?foolSourceView(s,s.fool.source):s;
  const combat=s.combat?{...(s.progression.pathwayId==='tyrant'&&(s.progression.sequence===7||s.progression.sequence===6)?{water:clone(s.combat.navigatorWater??{soakedRemaining:0,bound:false,skipNext:false})}:{}),...(s.progression.pathwayId==='tyrant'&&(s.progression.sequence===8||s.progression.sequence===7||s.progression.sequence===6)?{rage:{charge:s.combat.wrathCharge??0}}:{}),title:s.combat.encounterId==='DRUID_DISPUTE'?'原外院 · 马伦的阻拦':s.combat.encounterId==='PUNISHMENT_KNIGHT_DISPUTE'?'原外院 · 迪恩的阻拦':s.combat.encounterId==='MENTOR_DISORDER_DISPUTE'?'原外院 · 里斯的阻拦':s.combat.encounterId==='WINNER_DISPUTE'?'原外院 · 奥德里的阻拦':s.combat.encounterId==='WRAITH_DISPUTE'?'原外院 · 贝文的阻拦':s.combat.encounterId==='DESIRE_APOSTLE_DISPUTE'?'原外院 · 费兰的阻拦':s.combat.encounterId==='SHEPHERD_DISPUTE'?'原外院 · 埃尔顿的阻拦':s.combat.encounterId==='STAR_MYSTIC_DISPUTE'?'原外院 · 布莱斯的阻拦':s.combat.encounterId==='PAIN_DISPUTE'?'原外院 · 奥伦的阻拦':s.combat.encounterId==='GUARDIAN_DISPUTE'?'原外院 · 埃德温的阻拦':s.combat.encounterId==='DREAM_STEALER_DISPUTE'?'原纸箱房 · 马洛的阻拦':s.combat.encounterId==='TRAVELER_DISPUTE'?'原货房 · 贝兰的阻拦':s.combat.encounterId==='GATEKEEPER_DISPUTE'?'原纪念院 · 洛克的阻拦':s.combat.encounterId==='PRIEST_OF_LIGHT_DISPUTE'?'原小院 · 凯恩的阻拦':s.combat.encounterId==='OCEAN_SINGER_DISPUTE'?'原码头工院 · 布伦的阻拦':s.combat.encounterId==='MYSTICISM_MAGISTER_DISPUTE'?'原工院 · 罗文的阻拦':s.combat.encounterId==='SPIRIT_WARLOCK_DISPUTE'?'原树院 · 奥林的阻拦':s.combat.encounterId==='CRIMSON_SCHOLAR_DISPUTE'?'原月光院 · 西德的阻拦':s.combat.encounterId==='ASTRONOMER_DISPUTE'?'原观测院 · 霍伯的阻拦':s.combat.encounterId==='DREAMWALKER_DISPUTE'?'原后院 · 马斯的阻拦':s.combat.encounterId==='REAPER_DISPUTE'?'原石院 · 维克的阻拦':s.combat.encounterId==='MARIONETTIST_DISPUTE'?'原前院 · 多恩的阻拦':s.combat.encounterId==='BIOLOGIST_DISPUTE'?'练习场外院 · 洛恩的阻拦':s.combat.encounterId==='JUDGE_DISPUTE'?'练习场外院 · 埃文的阻拦':s.combat.encounterId==='CORRUPTION_BARON_DISPUTE'?'练习场外院 · 沃恩的阻拦':s.combat.encounterId==='CALAMITY_PRIEST_DISPUTE'?'练习场外院 · 杜兰的阻拦':s.combat.encounterId==='ZOMBIE_DISPUTE'?'练习场外院 · 里德的阻拦':s.combat.encounterId==='DEMON_DISPUTE'?'练习场外院 · 莫顿的阻拦':s.combat.encounterId==='ROSE_BISHOP_DISPUTE'?'练习场外院 · 维恩的阻拦':s.combat.encounterId==='SCROLL_PROFESSOR_DISPUTE'?'练习间外院 · 卡尔的阻拦':s.combat.encounterId==='PLEASURE_DISPUTE'?'练习间外院 · 马伦的阻拦':s.combat.encounterId==='DAWN_PALADIN_DISPUTE'?'练习场外院 · 罗尔德的阻拦':s.combat.encounterId==='FIRE_THIEF_DISPUTE'?'教学室外院 · 贝林的阻拦':s.combat.encounterId==='RECORDER_DISPUTE'?'教学室外院 · 弥尔的阻拦':s.combat.encounterId==='SPIRIT_GUIDE_DISPUTE'?'纪念室外院 · 迪恩的阻拦':s.combat.encounterId==='NOTARY_DISPUTE'?'教堂工房外院 · 布伦的阻拦':s.combat.encounterId==='WIND_BLESSED_DISPUTE'?'维修院外场 · 鲁恩的阻拦':s.combat.encounterId==='POLYMATH_DISPUTE'?'教学室外院 · 伊恩的阻拦':s.combat.encounterId==='SOOTHER_DISPUTE'?'值班室外院 · 阿兰的阻拦':s.combat.encounterId==='POTION_PROFESSOR_DISPUTE'?'药房外院 · 艾文的阻拦':s.combat.encounterId==='ARTISAN_DISPUTE'?'工房外院 · 德文的阻拦':s.combat.encounterId==='HYPNOTIST_DISPUTE'?'会所后门 · 罗温的阻拦':s.combat.encounterId==='CONSPIRATOR_DISPUTE'?'货栈后门 · 奥伦的阻拦':s.combat.encounterId==='FACELESS_DISPUTE'?'排练后门 · 达恩的阻拦':s.combat.encounterId==='MARAUDER_DISPUTE'?'维修院 · 原短棍争端':s.combat.encounterId==='NIGHTMARE_DISPUTE'?'夜间后院 · 凯尔的阻拦':s.combat.encounterId==='MIDNIGHT_DISPUTE'?'夜间小院 · 贺恩的阻拦':s.combat.encounterId==='SLEEPLESS_WATCH'?'夜班外院 · 拉夫的阻拦':s.combat.encounterId==='VAMPIRE_DISPUTE'?'灯下通道 · 布鲁克的阻拦':s.combat.encounterId==='PSYCHOLOGIST_DISPUTE'?'会所门厅 · 布莱斯的威胁':s.combat.encounterId==='PYROMANIAC_DISPUTE'?'仓房砖院 · 哈恩的阻拦':s.combat.encounterId==='MAGICIAN_DISPUTE'?'剧场后巷 · 莫里的阻拦':s.combat.encounterId==='PROVOKER_DISPUTE'?'货栈入口 · 威斯的阻拦':s.combat.encounterId==='HUNTER_CARGO'?'仓库货道 · 取回通行权':s.combat.encounterId==='CLOWN_RESCUE'?'码头巷口 · 护送冲突':'首案 · 追击携铃者',round:s.combat.round,enemyName:s.combat.encounterId==='DRUID_DISPUTE'?'持普通短棍的马伦':s.combat.encounterId==='PUNISHMENT_KNIGHT_DISPUTE'?'持普通短棍的迪恩':s.combat.encounterId==='MENTOR_DISORDER_DISPUTE'?'持普通短棍的里斯':s.combat.encounterId==='WINNER_DISPUTE'?'持普通短棍的奥德里':s.combat.encounterId==='WRAITH_DISPUTE'?'持普通短棍的贝文':s.combat.encounterId==='DESIRE_APOSTLE_DISPUTE'?'持普通短棍的费兰':s.combat.encounterId==='SHEPHERD_DISPUTE'?'持普通短棍的埃尔顿':s.combat.encounterId==='STAR_MYSTIC_DISPUTE'?'持普通短棍的布莱斯':s.combat.encounterId==='PAIN_DISPUTE'?'持普通短棍的奥伦':s.combat.encounterId==='GUARDIAN_DISPUTE'?'持普通短棍的埃德温':s.combat.encounterId==='DREAM_STEALER_DISPUTE'?'持普通短棍的马洛':s.combat.encounterId==='TRAVELER_DISPUTE'?'持普通短棍的贝兰':s.combat.encounterId==='GATEKEEPER_DISPUTE'?'持普通短棍的洛克':s.combat.encounterId==='PRIEST_OF_LIGHT_DISPUTE'?'持普通短棍的凯恩':s.combat.encounterId==='OCEAN_SINGER_DISPUTE'?'持普通短棍的布伦':s.combat.encounterId==='MYSTICISM_MAGISTER_DISPUTE'?'持普通短棍的罗文':s.combat.encounterId==='SPIRIT_WARLOCK_DISPUTE'?'持普通短棍的奥林':s.combat.encounterId==='CRIMSON_SCHOLAR_DISPUTE'?'持普通短棍的西德':s.combat.encounterId==='ASTRONOMER_DISPUTE'?'持普通短棍的霍伯':s.combat.encounterId==='DREAMWALKER_DISPUTE'?'清醒持棍的马斯':s.combat.encounterId==='REAPER_DISPUTE'?'持普通短棍的维克':s.combat.encounterId==='MARIONETTIST_DISPUTE'?'持自己原短棍的多恩':s.combat.encounterId==='BIOLOGIST_DISPUTE'?'持普通短棍的洛恩':s.combat.encounterId==='JUDGE_DISPUTE'?'持普通短棍的埃文':s.combat.encounterId==='CORRUPTION_BARON_DISPUTE'?'持普通短棍的沃恩':s.combat.encounterId==='CALAMITY_PRIEST_DISPUTE'?'持普通短棍的杜兰':s.combat.encounterId==='ZOMBIE_DISPUTE'?'持普通短棍的里德':s.combat.encounterId==='DEMON_DISPUTE'?'持普通短棍的莫顿':s.combat.encounterId==='ROSE_BISHOP_DISPUTE'?'持普通短棍的维恩':s.combat.encounterId==='SCROLL_PROFESSOR_DISPUTE'?'持普通短棍的卡尔':s.combat.encounterId==='PLEASURE_DISPUTE'?'持普通短棍的马伦':s.combat.encounterId==='DAWN_PALADIN_DISPUTE'?'持普通短棍的罗尔德':s.combat.encounterId==='FIRE_THIEF_DISPUTE'?'持原短棍的歌颂者贝林':s.combat.encounterId==='RECORDER_DISPUTE'?'持普通短棍的弥尔':s.combat.encounterId==='SPIRIT_GUIDE_DISPUTE'?'持普通短棍的迪恩':s.combat.encounterId==='NOTARY_DISPUTE'?'持普通短棍的布伦':s.combat.encounterId==='WIND_BLESSED_DISPUTE'?'持普通短棍的鲁恩':s.combat.encounterId==='POLYMATH_DISPUTE'?'持普通短棍的伊恩':s.combat.encounterId==='SOOTHER_DISPUTE'?'持普通短棍的阿兰':s.combat.encounterId==='POTION_PROFESSOR_DISPUTE'?'持普通短棍的艾文':s.combat.encounterId==='ARTISAN_DISPUTE'?'持普通短棍的德文':s.combat.encounterId==='HYPNOTIST_DISPUTE'?'持普通短棍的罗温':s.combat.encounterId==='CONSPIRATOR_DISPUTE'?'持普通短棍的奥伦':s.combat.encounterId==='FACELESS_DISPUTE'?'持普通短棍的达恩':s.combat.encounterId==='MARAUDER_DISPUTE'?(marauderEnemyArmed(s)?'持原短棍的塞蒙':'徒手塞蒙'):s.combat.encounterId==='NIGHTMARE_DISPUTE'?'持短棍的凯尔':s.combat.encounterId==='MIDNIGHT_DISPUTE'?'持短棍的贺恩':s.combat.encounterId==='SLEEPLESS_WATCH'?'持短棍的拉夫':s.combat.encounterId==='VAMPIRE_DISPUTE'?'持短棍的布鲁克':s.combat.encounterId==='PSYCHOLOGIST_DISPUTE'?'持短棍的布莱斯':s.combat.encounterId==='PYROMANIAC_DISPUTE'?'持短棍的哈恩':s.combat.encounterId==='MAGICIAN_DISPUTE'?'堵住剧场后巷的莫里':s.combat.encounterId==='PROVOKER_DISPUTE'?'持短棍的搬运头领威斯':s.combat.encounterId==='HUNTER_CARGO'?'持短棍的拦路者':s.combat.encounterId==='CLOWN_RESCUE'?'拦路的短棍勒索者':'持短棍的携铃者',enemyHealth:s.combat.enemyHealth,...(s.progression.pathwayId==='audience'&&(s.progression.sequence===7||s.progression.sequence===6)?{enemyMind:s.combat.enemyMind}:{}),enemyStatus:s.combat.enemyStatus,playerCountWheel:playerCountWheel(s),enemyCountWheel:(s.combat.encounterId==='FIRE_THIEF_DISPUTE'?BARD_COUNT_WHEEL:ORDINARY_COUNT_WHEEL).map(x=>({...x})),playerAbilityWheel:playerAbilityWheel(s,null),playerAbilityWheels:{ATTACK:playerAbilityWheel(s,'ATTACK'),DEFEND:playerAbilityWheel(s,'DEFEND'),CONTROL:playerAbilityWheel(s,'CONTROL'),PREPARE:playerAbilityWheel(s,'PREPARE'),RETREAT:[]},enemyAbilityWheel:s.combat.encounterId==='FIRE_THIEF_DISPUTE'?bardAbilityWheel(null):ordinaryAbilityWheel(marauderEnemyArmed(s),null),consequenceWeights:nextLosingInjuryWeights(s),stances:[{id:'ATTACK' as const,label:'进攻',description:'普通打击权重×1.25，再归一化'},{id:'DEFEND' as const,label:'防守',description:'格挡护身权重×1.25，再归一化'},...(s.progression.pathwayId!==null?[{id:'CONTROL' as const,label:'辨识',description:s.progression.pathwayId==='mother'?'土壤、时令与实际照护需要核实和等待，收获有限，不凭空造粮或改变天气。':s.progression.pathwayId==='justiciar'?'权威与精神影响可能被抵抗，线索与供述仍须核实，不自动获得公职或确定真相。':s.progression.pathwayId==='black-emperor'?'读懂规则与论据，协商仍保留本人选择，不能改写事实或强迫同意。':s.progression.pathwayId==='wheel'?'偶发片段与当前事实分开，不能任意读取未来，也不能控制好运。':s.progression.pathwayId==='chained'?'身体与知觉服务于眼前事实；随手物品必须实际持有，不免伤、不狂化、不狼变。':s.progression.pathwayId==='abyss'?'只依眼前动作作有限警觉与实际身体应对，不预知未来致命危险、不免毒或生成恶魔法术。':s.progression.pathwayId==='hanged-man'?'本场原对手为普通人，没有已知隐秘存在或仪式现场；感知回退普通防御，准备0贡献，不造血肉或神谕。':s.progression.pathwayId==='hermit'?(s.progression.sequence===7?'实际学过的G教学术才可施用；不足灵性回退身体/工具，本场不凭空生成卷轴或高阶再现。':'眼前有限灵视与普通身体、工具；本场没有预先备好的仪式来源，准备不凭空召来力量。'):s.progression.pathwayId==='demoness'?(s.progression.sequence===6?'丝线须先实际预备再接触对抗，只限制下一次符合条件的身体动作；黑焰、冰霜与原镜片各有真实成本，魅惑不改变本人同意。':'本场没有已登记暗影掩护，用普通脚步应对；爆发占实际一次行动，非必杀。'):s.progression.pathwayId==='warrior'?(s.progression.sequence===6?'晨曦剑、光甲与风暴须实际凝成并支付成本；本场普通人没有太阳易伤或幻象，不凭空提供破幻目标，不替同伴承担伤害。':`使用本人实际身体、原武器与普通脚步；准备不赠攻击，不生成光甲或免疫恐惧。${s.progression.sequence===7?'弱点两段需要真实持械与本场已见动作；当前'+(s.combat.weaponmasterWeakPoint?.prepared?'已标记，后续再抽中才尝试高优势':'尚未标记')+'，不直接判死。':''}`):s.progression.pathwayId==='error'?(s.progression.sequence===6?'只对当前实际已见能力尝试暂时窃取；己方可用与原主失能是两个有限窗口，不会永久学会或偷取想法。':([8,7].includes(s.progression.sequence!)?`${s.progression.sequence===7?'解读本轮已见的真实动作，不预读未来或复制能力。':''}依据本场已见动作误导普通敌人。两次准备完成后转用其剩余一次机会，并使下一次实际动作失效；每次效果有条件和成本，不增加总机会。当前：${s.combat.swindlerDeceit?.prepared?'已准备':'未准备'}，${s.combat.swindlerDeceit?.skipNext?'等待敌方下一实际动作':'暂无待生效误导'}。` :s.combat.encounterId==='MARAUDER_DISPUTE'?'控制槽尝试取走眼前原短棍：成功0即时贡献，之后双方使用当前实物；失败可能留下本回合一次反击窗口':'以当前身体敏捷与持握原工具应对；本场无登记可窃取原件，普通牵制不偷取抽象能力或资源')):s.progression.pathwayId==='door'?(s.progression.sequence===6?'亲见记录的原份额须明确选择，首次抽中释放槽才使用，随后原记录耗尽；未抽中或保留不消耗。没有已记录来源不生成能力或旅行。':(s.progression.sequence===8||s.progression.sequence===7)?'低威力戏法作用于实际对象，耗费灵性，不保证控制；没有合格原门障时不凭空穿门取消攻击':'当前首案没有可穿行的原门障，开门不凭空取消敌方攻击；用实际身体、原工具与普通退路行动'):s.progression.pathwayId==='death'?(s.progression.sequence===6?'亡者之语有限作用于当前普通敌人的灵体，可被抵抗；不带信使作战、不凭空召军或下放冥界门。':'尸体特质不免疫普通武器，死亡之眼仅对适用的不死/灵界生物识别弱点；当前普通人以真实身体、工具和现场牵制应对'):s.progression.pathwayId==='sun'?(s.progression.sequence===6?'公证只有限增强实际施用的既有能力，准备本身0贡献；不把未签名的对手自动绑定，不将普通人标作太阳易伤。':(s.progression.sequence===8||s.progression.sequence===7)?'有限日光与金焰只对当前实际对象结算，普通敌人没有太阳易伤，不扫描秘密或消除全部污染':'出声歌颂鼓舞自己并稳定士气，不强迫敌人服从、不治疗伤势或凭空获得光焰'):s.progression.pathwayId==='tyrant'?(s.progression.sequence===6?'有限风刃与控风需要当前目标和灵性，继承水缚可抵抗；短距飞行不自动替代战斗撤退。':s.progression.sequence===7?'对本场需要呼吸的原敌有限用水；水缚可被消耗或抵抗，不改变整片场景或额外增加行动':'沿本人实际体魄、平衡与持用工具应对；陆地不凭空变水域，幻鳞不等于刀枪不入'):s.progression.pathwayId==='white-tower'?'只整理当前已见的普通动作，不复制能力或读取未来；缺仪式准备按普通规则应对':s.progression.pathwayId==='darkness'?(s.progression.sequence===7?'先逐步影响当前清醒目标，控梦期间本体不能移动且可能暴露':s.progression.sequence===8?'在旁人已离开的真实声场有限吟唱，可能被抵抗或打断，不入梦':'在已确认的夜间观察当前危险，不窥梦、不以诗歌控制他人'):s.progression.pathwayId==='moon'?(s.progression.sequence===7?'仅对本场已亲见的影子和空间运用短缚、翼步；不删除敌人行动或保证控制':'依靠当前身体与普通装备；药剂需要独立准备，不能在此凭空治疗或下毒'):s.progression.pathwayId==='paragon'?(s.progression.sequence===7?'本场没有可供鉴定的超凡原物，依靠普通身体与实际装备，不复制敌方技能':'依靠普通身体和实际装备，没有读心、灵视或非凡鉴定效果'):s.progression.pathwayId==='audience'?(s.progression.sequence===7?'依当前真实对象运用精神影响；不保证控制或消除污染':s.progression.sequence===8?'读取当前浅层想法，不强迫行动或搜索记忆':'观察眼前动作并谨慎推断，不读取内心或控制对方'):s.progression.pathwayId==='hunter'&&s.progression.sequence===5?'弱点观察实际耗2灵性并保留短暂窗口；精确打击只消费当前窗口一次，不必杀、不无视所有防御。':s.progression.pathwayId==='hunter'&&s.progression.sequence===8?'依据实际人物情报挑衅，可能招致更积极的进攻':s.progression.pathwayId==='hunter'?'倾向当前威胁下的猎杀直觉；不控制他人心智':'倾向灵视与直觉；没有合格来源时不产生额外效果'},{id:'PREPARE' as const,label:'观察',description:'调整注意；不附送攻击或未知事实'}]:[]),{id:'RETREAT' as const,label:'尝试撤退',description:'本回合全部行动用于撤离，失败仍可能受伤或死亡'}],lastRound:publicCombatRound(s.combat.lastRound)}:null;
  if(combat&&s.combat?.encounterId==='BIZARRO_RITUAL'){const detail=projectBizarroCombat(s);if(detail){combat.title='原钟舞台 · 帷幕兽';combat.enemyName=detail.enemyName;combat.enemyCountWheel=BIZARRO_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=BIZARRO_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{bizarro:detail});}}
  if(combat&&s.combat?.encounterId==='IRON_BLOOD_DISPUTE'){const detail=projectIronBloodCombat(s);combat.title='铁血骑士 · 原石院冲突';combat.enemyName=detail.enemyName;Object.assign(combat,{ironBlood:detail});}
  if(combat&&s.combat?.encounterId==='MANIPULATOR_DISPUTE'){const d=projectManipulatorCombat(audienceProjectionView);combat.title='操纵师 · 原仓院冲突';combat.enemyName=d.enemyName;Object.assign(combat,{manipulator:{mentalPlague:d.mentalPlague,mentalDefence:d.mentalDefence,summary:d.summary}});}
  if(combat&&s.combat?.encounterId==='ALCHEMIST_DISPUTE'){const f=s.alchemist.life.creations.find(x=>x.id==='AL4-FRAME-1'&&x.location==='YARD');combat.title='炼金术士 · 原工房院落';combat.enemyName='奥斯里克';Object.assign(combat,{alchemist:{creationId:f?.id??null,charge:f?.charge??0,durability:f?.durability??0,active:f?.active??false,summary:f?'同一本人自制原护架；战中消耗持续保留，不能自动充能或修复。':'当前没有实际在场原护架，相关能力只能普通回退。'}});}
  if(combat&&s.combat?.encounterId==='PROPHET_DISPUTE'){combat.title='预言家 · 原档案院';combat.enemyName='哈罗德·布伦特';Object.assign(combat,{prophet:projectProphetCombat(s)});}
  if(combat&&s.combat?.encounterId==='NIGHTWATCHER_DISPUTE'){combat.title='守夜人 · 原练习小院';combat.enemyName='布拉姆·洛';Object.assign(combat,{nightwatcher:projectNightwatcherCombat(s)});}
  if(combat&&s.combat?.encounterId==='WITCH_KING_DISPUTE'){combat.title='巫王 · 原夜间小院';combat.enemyName='多里安';Object.assign(combat,{witchKing:projectWitchKingCombat(s)});}
  if(combat&&s.combat?.encounterId==='NIGHTWATCHER_DISPUTE'){combat.title='守夜人 · 原值夜院';combat.enemyName='布拉姆';}
  if(combat&&s.combat?.encounterId==='PROPHET_DISPUTE'){combat.title='预言家 · 原档案院';combat.enemyName='哈罗德';}
  if(combat&&s.combat?.encounterId==='CATACLYSM_PRIEST_DISPUTE'){combat.title='灾难主祭 · 原岸边石院';combat.enemyName='本尼迪克特·维尔';Object.assign(combat,{cataclysmPriest:projectCataclysmPriestCombat(s)});}
  if(combat&&s.combat?.encounterId==='UNSHADOWED_DISPUTE'){combat.title='无暗者 · 原石礼堂院';combat.enemyName='埃德蒙·塔尔';Object.assign(combat,{unshadowed:projectUnshadowedCombat(s)});}
  if(combat&&s.combat?.encounterId==='UNDYING_DISPUTE'){combat.title='不死者 · 原纪念馆石庭';combat.enemyName='欧文·戴尔';Object.assign(combat,{undying:projectUndyingCombat(s)});}
  if(combat&&s.combat?.encounterId==='SECRETS_SORCERER_RITUAL'){combat.title='秘法师 · 原石拱封印';combat.enemyName=projectSecretsSorcererCombat(s).enemyName;Object.assign(combat,{secretsSorcerer:projectSecretsSorcererCombat(s)});}
  if(combat&&s.combat?.encounterId==='PARASITE_DISPUTE'){combat.title='寄生者 · 原庭院争执';combat.enemyName=projectParasiteCombat(s).enemyName;Object.assign(combat,{parasite:projectParasiteCombat(s)});}
  if(combat&&s.combat?.encounterId==='DEMON_HUNTER_DISPUTE'){combat.title='猎魔者 · 原守卫交战';combat.enemyName=projectDemonHunterCombat(s).enemyName;Object.assign(combat,{demonHunter:projectDemonHunterCombat(s)});}
  if(combat&&s.combat?.encounterId==='DESPAIR_DISPUTE'){combat.title='绝望魔女 · 原院交战';combat.enemyName=projectDespairCombat(s).enemyName;Object.assign(combat,{despair:projectDespairCombat(s)});}
  if(combat&&s.combat?.encounterId==='MYSTIC_DISPUTE'){combat.title='神秘学家 · 原院交战';combat.enemyName=projectMysticCombat(s).enemyName;Object.assign(combat,{mystic:projectMysticCombat(s)});}
  if(combat&&s.combat?.encounterId==='BLACK_KNIGHT_DISPUTE'){combat.title='黑骑士 · 原院交战';combat.enemyName=projectBlackKnightCombat(s).enemyName;Object.assign(combat,{blackKnight:projectBlackKnightCombat(s)});}
  if(combat&&s.combat?.encounterId==='DEVIL_DISPUTE'){combat.title='魔鬼 · 原院交战';combat.enemyName=projectDevilCombat(s).enemyName;Object.assign(combat,{devil:projectDevilCombat(s)});}
  if(combat&&s.combat?.encounterId==='PUPPET_DISPUTE'){combat.title='木偶 · 原院交战';combat.enemyName=projectPuppetCombat(s).enemyName;Object.assign(combat,{puppet:projectPuppetCombat(s)});}
  if(combat&&s.combat?.encounterId==='MISFORTUNE_MAGE_DISPUTE'){combat.title='厄运法师 · 原院交战';combat.enemyName=projectMisfortuneMageCombat(s).enemyName;Object.assign(combat,{misfortuneMage:projectMisfortuneMageCombat(s)});}
  if(combat&&s.combat?.encounterId==='FALLEN_EARL_DISPUTE'){combat.title='堕落伯爵 · 原院交战';combat.enemyName=projectFallenEarlCombat(s).enemyName;Object.assign(combat,{fallenEarl:projectFallenEarlCombat(s)});}
  if(combat&&s.combat?.encounterId==='IMPERATIVE_MAGE_DISPUTE'){combat.title='律令法师 · 原院交战';combat.enemyName=projectImperativeMageCombat(s).enemyName;Object.assign(combat,{imperativeMage:projectImperativeMageCombat(s)});}
  if(combat&&s.combat?.encounterId==='ANCIENT_ALCHEMIST_DISPUTE'){combat.title='古代炼金师 · 原院交战';combat.enemyName=projectAncientAlchemistCombat(s).enemyName;Object.assign(combat,{ancientAlchemist:projectAncientAlchemistCombat(s)});}
  if(combat&&(s.combat?.encounterId==='SILVER_KNIGHT_HUNT'||s.combat?.encounterId==='SILVER_KNIGHT_DISPUTE')){combat.title=s.combat.encounterId==='SILVER_KNIGHT_HUNT'?'银骑士仪式G · 本人亲猎':'银骑士G · 原院交战';combat.enemyName=projectSilverKnightCombat(s).enemyName;combat.enemyCountWheel=SILVER_KNIGHT_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=SILVER_KNIGHT_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{silverKnight:projectSilverKnightCombat(s)});}
  if(combat&&s.combat?.encounterId==='COFFIN_BEARER_DISPUTE'){combat.title='抬棺人G · 原庭院交战';combat.enemyName=projectCoffinBearerCombat(s).enemyName;Object.assign(combat,{coffinBearer:projectCoffinBearerCombat(s)});}
  if(combat&&s.combat?.encounterId==='CHAOS_HUNTER_DISPUTE'){combat.title='混乱猎手G · 原庭院交战';combat.enemyName=projectChaosHunterCombat(s).enemyName;Object.assign(combat,{chaosHunter:projectChaosHunterCombat(s)});}
  if(combat&&s.combat?.encounterId==='FRENZY_MAGE_DISPUTE'){combat.title='狂乱法师G · 原庭院交战';combat.enemyName=projectFrenzyMageCombat(s).enemyName;Object.assign(combat,{frenzyMage:projectFrenzyMageCombat(s)});}
  if(combat&&s.combat?.encounterId==='CHAOS_WALKER_DISPUTE'){combat.title='候选混乱行者G · 原庭院交战';combat.enemyName=projectChaosWalkerCombat(s).enemyName;Object.assign(combat,{chaosWalker:projectChaosWalkerCombat(s)});}
  if(combat&&s.combat?.encounterId==='SILENT_DISCIPLE_DISPUTE'){combat.title='沉默门徒G · 原庭院交战';combat.enemyName=projectSilentDiscipleCombat(s).enemyName;Object.assign(combat,{silentDisciple:projectSilentDiscipleCombat(s)});}
  if(combat&&s.combat?.encounterId==='BLATHERER_COURT'){combat.title='呓语者G · 原附院交战';combat.enemyName=projectBlathererCombat(s).enemyName;Object.assign(combat,{blatherer:projectBlathererCombat(s)});}
  if(combat&&s.combat?.encounterId==='THREE_HEADED_TEMPLAR_DISPUTE'){combat.title='三首圣堂G · 原附院交战';combat.enemyName=projectThreeHeadedTemplarCombat(s).enemyName;Object.assign(combat,{threeHeadedTemplar:projectThreeHeadedTemplarCombat(s)});}
  if(combat&&s.combat?.encounterId==='PROPHECY_MASTER_DISPUTE'){combat.title='预言大师G · 原附院交战';combat.enemyName=projectProphecyMasterCombat(s).enemyName;Object.assign(combat,{prophecyMaster:projectProphecyMasterCombat(s)});}
  if(combat&&s.combat?.encounterId==='UNAGING_DEMONESS_DISPUTE'){combat.title='不老魔女 · 原镜小院交战';combat.enemyName=projectUnagingDemonessCombat(s).enemyName;combat.enemyCountWheel=UNAGING_DEMONESS_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=UNAGING_DEMONESS_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{unagingDemoness:projectUnagingDemonessCombat(s)});}
  if(combat&&s.combat?.encounterId==='DECEIT_MENTOR_DISPUTE'){combat.title='欺瞒导师 · 原工作院交战';combat.enemyName=projectDeceitMentorCombat(s).enemyName;combat.enemyCountWheel=DECEIT_MENTOR_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=DECEIT_MENTOR_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{deceitMentor:projectDeceitMentorCombat(s)});}
  if(combat&&s.combat?.encounterId==='WANDERER_DISPUTE'){combat.enemyCountWheel=WANDERER_ENEMY_COUNT_WHEEL.map(entry=>({...entry}));combat.enemyAbilityWheel=WANDERER_ENEMY_ABILITY_WHEEL.map(entry=>({...entry}));combat.title='漫游者G · 原工作院交战';combat.enemyName=projectWandererCombat(s).enemyName;Object.assign(combat,{wanderer:projectWandererCombat(s)});}
  if(combat&&s.combat?.encounterId==='FERRYMAN_DISPUTE'){combat.title='摆渡人G · 原工作院交战';combat.enemyName=projectFerrymanCombat(s).enemyName;Object.assign(combat,{ferryman:projectFerrymanCombat(s)});}
  if(combat&&s.combat?.encounterId==='JUSTICE_MENTOR_DISPUTE'){combat.title='正义导师G · 原工作院交战';combat.enemyName=projectJusticeMentorCombat(s).enemyName;Object.assign(combat,{justiceMentor:projectJusticeMentorCombat(s)});}
  if(combat&&s.combat?.encounterId==='SEA_KING_DISPUTE'){combat.title='海王 · 原干燥码头交战';combat.enemyName=projectSeaKingCombat(s).enemyName;combat.enemyCountWheel=SEA_KING_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=SEA_KING_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{seaKing:projectSeaKingCombat(s)});}
  if(combat&&s.combat?.encounterId==='INSIGHT_SCHOLAR_DISPUTE'){combat.title='洞悉者候选G · 原库庭交战';combat.enemyName=projectInsightScholarCombat(s).enemyName;combat.enemyCountWheel=INSIGHT_SCHOLAR_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=INSIGHT_SCHOLAR_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{insightScholar:projectInsightScholarCombat(s)});}
  if(combat&&s.combat?.encounterId==='FEAR_BISHOP_DISPUTE'){combat.title='恐惧主教 · 原库庭交战';combat.enemyName=projectFearBishopCombat(s).enemyName;combat.enemyCountWheel=FEAR_BISHOP_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=FEAR_BISHOP_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{fearBishop:projectFearBishopCombat(s)});}
  if(combat&&s.combat?.encounterId==='SUMMONING_MASTER_DISPUTE'){combat.title='召唤大师 · 原工坊石院交战';combat.enemyName=projectSummoningMasterCombat(s).enemyName;combat.enemyCountWheel=SUMMONING_MASTER_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=SUMMONING_MASTER_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{summoningMaster:projectSummoningMasterCombat(s)});}
  if(combat&&s.combat?.encounterId==='ARCANE_SCHOLAR_DISPUTE'){combat.title='奥秘学者 · 原工坊石院交战';combat.enemyName=projectArcaneScholarCombat(s).enemyName;combat.enemyCountWheel=ARCANE_SCHOLAR_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=ARCANE_SCHOLAR_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{arcaneScholar:projectArcaneScholarCombat(s)});}
  if(combat&&s.combat?.encounterId==='DREAM_WEAVER_DISPUTE'){combat.title='织梦人 · 原阅览处外院交战';combat.enemyName=projectDreamWeaverCombat(audienceProjectionView).enemyName;combat.enemyCountWheel=DREAM_WEAVER_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=DREAM_WEAVER_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{dreamWeaver:projectDreamWeaverCombat(audienceProjectionView)});}
  if(combat&&s.combat?.encounterId==='WAR_BISHOP_DISPUTE'){combat.title='战争主教 · 原队伍与石院交战';combat.enemyName=projectWarBishopCombat(s).enemyName;combat.enemyCountWheel=WAR_BISHOP_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=WAR_BISHOP_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{warBishop:projectWarBishopCombat(s)});}
  if(combat&&s.combat?.encounterId==='PALE_EMPEROR_DISPUTE'){combat.title='苍白皇帝 · 当代附廊外前庭';combat.enemyName=projectPaleEmperorCombat(s).enemyName;combat.enemyCountWheel=PALE_EMPEROR_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=PALE_EMPEROR_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{enemyMind:s.combat.enemyMind,paleEmperor:projectPaleEmperorCombat(s)});}
  if(combat&&s.combat?.encounterId==='PURE_WHITE_ANGEL_DISPUTE'){combat.title='纯白天使 · 采光廊外前庭';combat.enemyName=projectPureWhiteAngelCombat(s).enemyName;combat.enemyCountWheel=PURE_WHITE_ANGEL_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=PURE_WHITE_ANGEL_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{enemyMind:s.combat.enemyMind,pureWhiteAngel:projectPureWhiteAngelCombat(s)});}
  if(combat&&s.combat?.encounterId==='THUNDER_GOD_DISPUTE'){combat.title='雷神 · 原湾出口外石台';combat.enemyName=projectThunderGodCombat(s).enemyName;combat.enemyCountWheel=THUNDER_GOD_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=THUNDER_GOD_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{enemyMind:s.combat.enemyMind,thunderGod:projectThunderGodCombat(s)});}
  if(combat&&s.combat?.encounterId==='NATURE_WALKER_DISPUTE'){combat.title='自然行者 · 邻侧苗圃';combat.enemyName=projectNatureWalkerCombat(s).enemyName;combat.enemyCountWheel=NATURE_WALKER_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=NATURE_WALKER_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{enemyMind:s.combat.enemyMind,natureWalker:projectNatureWalkerCombat(s)});}
  if(combat&&s.combat?.encounterId==='HAND_OF_ORDER_DISPUTE'){combat.title='秩序之手 · 邻侧分场';combat.enemyName=projectHandOfOrderCombat(s).enemyName;combat.enemyCountWheel=HAND_OF_ORDER_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=HAND_OF_ORDER_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{enemyMind:s.combat.enemyMind,handOfOrder:projectHandOfOrderCombat(s)});}
  if(combat&&s.combat?.encounterId==='PRINCE_OF_ABOLITION_DISPUTE'){combat.title='弑序亲王 · 承接区邻院';combat.enemyName=projectPrinceOfAbolitionCombat(s).enemyName;combat.enemyCountWheel=PRINCE_OF_ABOLITION_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=PRINCE_OF_ABOLITION_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{enemyMind:s.combat.enemyMind,princeOfAbolition:projectPrinceOfAbolitionCombat(s)});}
  if(combat&&s.combat?.encounterId==='MERCURY_SNAKE_DISPUTE'){combat.title='水银之蛇 · 工房邻院';combat.enemyName=projectMercurySnakeCombat(s).enemyName;combat.enemyCountWheel=MERCURY_SNAKE_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=MERCURY_SNAKE_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{enemyMind:s.combat.enemyMind,mercurySnake:projectMercurySnakeCombat(s)});}
  if(combat&&s.combat?.encounterId==='ABOMINATION_DISPUTE'){combat.title='神孽 · 安静室邻院';combat.enemyName=projectAbominationCombat(s).enemyName??'尚未接触的对手';combat.enemyCountWheel=ABOMINATION_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=ABOMINATION_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{enemyMind:s.combat.enemyMind,abomination:projectAbominationCombat(s)});}
  if(combat&&s.combat?.encounterId==='UNCLEAN_MONARCH_DISPUTE'){combat.title='污秽君王 · 安静室邻院';combat.enemyName=projectUncleanMonarchCombat(s).enemyName??'尚未接触的对手';combat.enemyCountWheel=UNCLEAN_MONARCH_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=UNCLEAN_MONARCH_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{enemyMind:s.combat.enemyMind,uncleanMonarch:projectUncleanMonarchCombat(s)});}
  if(combat&&s.combat?.encounterId==='DARK_ANGEL_DISPUTE'){combat.title='暗天使 · 封存院外前庭';combat.enemyName=projectDarkAngelCombat(s).enemyName??'尚未接触的对手';combat.enemyCountWheel=DARK_ANGEL_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=DARK_ANGEL_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{enemyMind:s.combat.enemyMind,darkAngel:projectDarkAngelCombat(s)});}
  if(combat&&s.combat?.encounterId==='KNOWLEDGE_EMPEROR_DISPUTE'){combat.title='知识皇帝 · 阅览院';combat.enemyName=projectKnowledgeEmperorCombat(s).enemyName??'尚未接触的对手';combat.enemyCountWheel=KNOWLEDGE_EMPEROR_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=KNOWLEDGE_EMPEROR_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{enemyMind:s.combat.enemyMind,knowledgeEmperor:projectKnowledgeEmperorCombat(s)});}
  if(combat&&s.combat?.encounterId==='APOCALYPSE_DEMONESS_DISPUTE'){combat.title='末日魔女 · 相邻修理院';combat.enemyName=projectApocalypseDemonessCombat(s).enemyName??'尚未接触的对手';combat.enemyCountWheel=APOCALYPSE_DEMONESS_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=APOCALYPSE_DEMONESS_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{enemyMind:s.combat.enemyMind,apocalypseDemoness:projectApocalypseDemonessCombat(s)});}
  if(combat&&s.combat?.encounterId==='DIVINE_HAND_DISPUTE'){combat.title='神明之手 · 修整室外前庭';combat.enemyName=projectDivineHandCombat(s).enemyName??'尚未接触的对手';combat.enemyCountWheel=DIVINE_HAND_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=DIVINE_HAND_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{enemyMind:s.combat.enemyMind,divineHand:projectDivineHandCombat(s)});}
  if(combat&&s.combat?.encounterId==='TIME_WORM_DISPUTE'){combat.title='时之虫 · 登记室外前庭';combat.enemyName=projectTimeWormCombat(s).enemyName??'尚未接触的对手';combat.enemyCountWheel=TIME_WORM_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=TIME_WORM_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{enemyMind:s.combat.enemyMind,timeWorm:projectTimeWormCombat(s)});}
  if(combat&&s.combat?.encounterId==='STAR_KEY_DISPUTE'){combat.title='星之匙 · 通行室外前庭';combat.enemyName=projectStarKeyCombat(s).enemyName;combat.enemyCountWheel=STAR_KEY_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=STAR_KEY_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{enemyMind:s.combat.enemyMind,starKey:projectStarKeyCombat(s)});}
  if(combat&&s.combat?.encounterId==='ALL_KNOWING_EYE_DISPUTE'){combat.title='全知之眼 · 阅览处外院';combat.enemyName=projectAllKnowingEyeCombat(s).enemyName;combat.enemyCountWheel=ALL_KNOWING_EYE_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=ALL_KNOWING_EYE_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{enemyMind:s.combat.enemyMind,allKnowingEye:projectAllKnowingEyeCombat(s)});}
  if(combat&&s.combat?.encounterId==='MISFORTUNE_KNIGHT_DISPUTE'){combat.title='厄难骑士 · 原院外石坪';combat.enemyName=projectMisfortuneKnightCombat(s).enemyName;combat.enemyCountWheel=MISFORTUNE_KNIGHT_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=MISFORTUNE_KNIGHT_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{enemyMind:s.combat.enemyMind,misfortuneKnight:projectMisfortuneKnightCombat(s)});}
  if(combat&&s.combat?.encounterId==='BEAUTY_GODDESS_DISPUTE'){combat.title='美神 · 玻璃廊外石坪';combat.enemyName=projectBeautyGoddessPublicCombat(s).enemyName;combat.enemyCountWheel=BEAUTY_GODDESS_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=BEAUTY_GODDESS_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{enemyMind:s.combat.enemyMind,beautyGoddess:projectBeautyGoddessPublicCombat(s)});}
  if(combat&&s.combat?.encounterId==='CIVILIZATION_ENLIGHTENER_DISPUTE'){combat.title='文明启蒙者 · 工坊外石院';combat.enemyName=projectCivilizationEnlightenerCombat(s).enemyName;combat.enemyCountWheel=CIVILIZATION_ENLIGHTENER_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=CIVILIZATION_ENLIGHTENER_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{enemyMind:s.combat.enemyMind,civilizationEnlightener:projectCivilizationEnlightenerCombat(s)});}
  if(combat&&s.combat?.encounterId==='WRITER_DISPUTE'){combat.title='作家 · 阅览处外石院';combat.enemyName=projectWriterCombat(audienceProjectionView).enemyName;combat.enemyCountWheel=WRITER_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=WRITER_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{enemyMind:s.combat.enemyMind,writer:projectWriterCombat(audienceProjectionView)});}
  if(combat&&s.combat?.encounterId==='CONQUEROR_DISPUTE'){combat.title='征服者 · 原院外石坪';combat.enemyName=projectConquerorCombat(s).enemyName;combat.enemyCountWheel=CONQUEROR_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=CONQUEROR_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{enemyMind:s.combat.enemyMind,conqueror:projectConquerorCombat(s)});}
  if(combat&&s.combat?.encounterId==='ATTENDANT_MYSTERIES_DISPUTE'){combat.title='诡秘侍者 · 原工坊外空地';combat.enemyName=projectAttendantMysteriesCombat(s).enemyName;combat.enemyCountWheel=ATTENDANT_MYSTERIES_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=ATTENDANT_MYSTERIES_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{attendantMysteries:projectAttendantMysteriesCombat(s)});}
  if(combat&&s.combat?.encounterId==='BARREN_MATRIARCH_DISPUTE'){combat.title='荒芜主母 · 原苗圃交接间';combat.enemyName=projectBarrenMatriarchCombat(s).enemyName;combat.enemyCountWheel=BARREN_MATRIARCH_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=BARREN_MATRIARCH_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{barrenMatriarch:projectBarrenMatriarchCombat(s)});}
  if(combat&&s.combat?.encounterId==='BALANCER_DISPUTE'){combat.title='平衡者 · 原净空标线演练房';combat.enemyName=projectBalancerCombat(s).enemyName;combat.enemyCountWheel=BALANCER_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=BALANCER_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{balancer:projectBalancerCombat(s)});}
  if(combat&&s.combat?.encounterId==='ENTROPY_DUKE_DISPUTE'){combat.title='熵之公爵 · 原投递间';combat.enemyName=projectEntropyDukeCombat(s).enemyName;combat.enemyCountWheel=ENTROPY_DUKE_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=ENTROPY_DUKE_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{entropyDuke:projectEntropyDukeCombat(s)});}
  if(combat&&s.combat?.encounterId==='FATE_PROPHET_DISPUTE'){combat.title='先知 · 原机械工房';combat.enemyName=projectFateProphetCombat(s).enemyName;combat.enemyCountWheel=FATE_PROPHET_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=FATE_PROPHET_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{fateProphet:projectFateProphetCombat(s)});}
  if(combat&&s.combat?.encounterId==='ANCIENT_EVIL_DISPUTE'){combat.title='古代邪物 · 原安静房';combat.enemyName=projectAncientEvilCombat(s).enemyName;combat.enemyCountWheel=ANCIENT_EVIL_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=ANCIENT_EVIL_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{ancientEvil:projectAncientEvilCombat(s)});}
  if(combat&&s.combat?.encounterId==='BLOOD_DUKE_DISPUTE'){combat.title='鲜血大公 · 原安静房';combat.enemyName=projectBloodDukeCombat(s).enemyName;combat.enemyCountWheel=BLOOD_DUKE_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=BLOOD_DUKE_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{bloodDuke:projectBloodDukeCombat(s)});}
  if(combat&&s.combat?.encounterId==='ELDER_DISPUTE'){combat.title='秽语长老 · 原庭院';combat.enemyName=projectElderCombat(s).enemyName;combat.enemyCountWheel=ELDER_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=ELDER_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{elder:projectElderCombat(s)});}
  if(combat&&s.combat?.encounterId==='SAGE_DISPUTE'){combat.title='贤者 · 档馆外院';combat.enemyName=projectSageCombat(s).enemyName;combat.enemyCountWheel=SAGE_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=SAGE_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{sage:projectSageCombat(s)});}
  if(combat&&s.combat?.encounterId==='CALAMITY_DEMONESS_DISPUTE'){combat.title='灾难魔女 · 镜廊外院';combat.enemyName=projectCalamityDemonessCombat(s).enemyName;combat.enemyCountWheel=CALAMITY_DEMONESS_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=CALAMITY_DEMONESS_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{calamityDemoness:projectCalamityDemonessCombat(s)});}
  if(combat&&s.combat?.encounterId==='GLORY_DISPUTE'){combat.title='荣耀者 · 修整室外院';combat.enemyName=projectGloryCombat(s).enemyName;combat.enemyCountWheel=GLORY_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=GLORY_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{glory:projectGloryCombat(s)});}
  if(combat&&s.combat?.encounterId==='FATE_TROJAN_DISPUTE'){combat.title='命运木马 · 登记所庭院';combat.enemyName=projectFateTrojanCombat(s).enemyName;combat.enemyCountWheel=FATE_TROJAN_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=FATE_TROJAN_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{fateTrojan:projectFateTrojanCombat(s)});}
  if(combat&&s.combat?.encounterId==='PLANESWALKER_DISPUTE'){combat.title='旅法师 · 星途接待场';combat.enemyName=projectPlaneswalkerCombat(s).enemyName;combat.enemyCountWheel=PLANESWALKER_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=PLANESWALKER_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{planeswalker:projectPlaneswalkerCombat(s)});}
  if(combat&&s.combat?.encounterId==='DEATH_CONSUL_DISPUTE'){combat.title='死亡执政官 · 两室交战';combat.enemyName=projectDeathConsulCombat(s).enemyName;combat.enemyCountWheel=DEATH_CONSUL_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=DEATH_CONSUL_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{deathConsul:projectDeathConsulCombat(s)});}
  if(combat&&s.combat?.encounterId==='LIGHT_SEEKER_DISPUTE'){combat.title='逐光者 · 采光廊';combat.enemyName=projectLightSeekerCombat(s).enemyName;combat.enemyCountWheel=LIGHT_SEEKER_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=LIGHT_SEEKER_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{lightSeeker:projectLightSeekerCombat(s)});}
  if(combat&&s.combat?.encounterId==='CATASTROPHE_DISPUTE'){combat.title='天灾 · 原小湾';combat.enemyName=projectCatastropheCombat(s).enemyName;combat.enemyCountWheel=CATASTROPHE_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=CATASTROPHE_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{catastrophe:projectCatastropheCombat(s)});}
  if(combat&&s.combat?.encounterId==='WISDOM_ANGEL_DISPUTE'){combat.title='智慧天使候选G · 原资料庭';combat.enemyName=projectWisdomAngelCombat(s).enemyName;combat.enemyCountWheel=WISDOM_ANGEL_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=WISDOM_ANGEL_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{wisdomAngel:projectWisdomAngelCombat(s)});}
  if(combat&&s.combat?.encounterId==='CONCEALMENT_SERVANT_DISPUTE'){combat.title='隐秘之仆候选 · 原门庭';combat.enemyName=projectConcealmentServantCombat(s).enemyName;combat.enemyCountWheel=CONCEALMENT_SERVANT_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=CONCEALMENT_SERVANT_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{concealmentServant:projectConcealmentServantCombat(s)});}
  if(combat&&s.combat?.encounterId==='LIFE_GIVER_DISPUTE'){const lifeGiver=publicLifeGiverCombat(s);combat.title='创生者 · 原小院';combat.enemyName=lifeGiver.enemyName;combat.enemyCountWheel=LIFE_GIVER_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=LIFE_GIVER_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{lifeGiver});}
  if(combat&&s.combat?.encounterId==='KNOWLEDGE_MENTOR_DISPUTE'){combat.title='知识导师候选 · 原工院';combat.enemyName=projectKnowledgeMentorCombat(s).enemyName;combat.enemyCountWheel=KNOWLEDGE_MENTOR_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=KNOWLEDGE_MENTOR_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{knowledgeMentor:projectKnowledgeMentorCombat(s)});}
  if(combat&&s.combat?.encounterId==='DISCERNER_DISPUTE'){combat.title='洞察者 · 原核验院';combat.enemyName=projectDiscernerCombat(audienceProjectionView).enemyName;combat.enemyCountWheel=DISCERNER_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=DISCERNER_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{discerner:projectDiscernerCombat(audienceProjectionView)});}
  if(combat&&s.combat?.encounterId==='WEATHER_WARLOCK_DISPUTE'){combat.title='天气术士 · 原蓄水院';combat.enemyName=projectWeatherWarlockCombat(s).enemyName;combat.enemyCountWheel=WEATHER_WARLOCK_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=WEATHER_WARLOCK_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{weatherWarlock:projectWeatherWarlockCombat(s)});}
  if(combat&&s.combat?.encounterId==='MIRACLE_WORKER_DISPUTE'){combat.title='奇迹师 · 原石场交战';combat.enemyName=projectMiracleWorkerCombat(s).enemyName;combat.enemyCountWheel=MIRACLE_WORKER_ENEMY_COUNT_WHEEL.map(x=>({...x}));combat.enemyAbilityWheel=MIRACLE_WORKER_ENEMY_ABILITY_WHEEL.map(x=>({...x}));Object.assign(combat,{miracleWorker:projectMiracleWorkerCombat(s)});}
  if(combat&&s.combat?.encounterId==='ANCIENT_SCHOLAR_DISPUTE'){combat.title='古代学者 · 后世原院交战';combat.enemyName=projectAncientScholarCombat(s).enemyName;Object.assign(combat,{ancientScholar:projectAncientScholarCombat(s)});}
  const hunter=projectHunter(hunterProjectionView);hunter.actions.push(...hunterAdventureActions(hunterProjectionView));if(s.progression.pathwayId==='hunter')hunter.story=HUNTER_CARGO_STORY;
  const clown=projectClown(divinerProjectionView),seer=projectSeer(divinerProjectionView);clown.actions.push(...clownAdventureActions(divinerProjectionView));if(s.progression.pathwayId==='diviner'&&s.progression.sequence===8){clown.abilities=[...seer.abilities,...clown.abilities];clown.story=s.clown.rescue.status==='AVAILABLE'?CLOWN_RESCUE_STORY:s.clown.rescue.status==='RESCUED'?'艾尔西已带着原包裹离开。护送结果保留，不会重新生成勒索者或奖励。':'这次护送已有记录，原包裹仍归原主人。';}
  const provoker=projectProvoker(hunterProjectionView);provoker.actions.push(...provokerAdventureActions(hunterProjectionView));provoker.cases=provokerAdventureCases(hunterProjectionView);if(s.progression.pathwayId==='hunter'&&s.progression.sequence===8){provoker.abilities=[...hunter.abilities,...provoker.abilities];provoker.story=PROVOKER_STORY;}
  const audience=projectAudience(audienceProjectionView);audience.actions.push(...audienceSocialActions(audienceProjectionView));audience.scenes=audienceSocialScenes(audienceProjectionView);
  const mindreader=projectMindreader(audienceProjectionView);mindreader.actions.push(...mindreaderSocialActions(audienceProjectionView));mindreader.scenes=mindreaderScenes(audienceProjectionView);if(s.progression.pathwayId==='audience'&&s.progression.sequence===8)mindreader.abilities=[...audience.abilities,...mindreader.abilities];
  const savant=projectSavant(paragonProjectionView);savant.actions.push(...savantCraftActions(paragonProjectionView));savant.projects=savantProjects(paragonProjectionView);
  const archaeologist=projectArchaeologist(paragonProjectionView);archaeologist.actions.push(...archaeologistActions(paragonProjectionView));archaeologist.sites=archaeologistSites(paragonProjectionView);if(paragonProjectionView.progression.pathwayId==='paragon'&&paragonProjectionView.progression.sequence===8)archaeologist.abilities=[...savant.abilities,...archaeologist.abilities];
  const apothecary=projectApothecary(moonS1ProjectionView);apothecary.actions.push(...apothecaryClinicActions(moonS1ProjectionView));apothecary.cases=apothecaryCases(moonS1ProjectionView);if(moonS1ProjectionView.progression.pathwayId==='moon'&&moonS1ProjectionView.progression.sequence!==9)apothecary.actions=apothecary.actions.filter(a=>['BUY_SUPPLIES','PREPARE_MEDICINE','USE_HEALING'].includes(a.command.type));
  const tamer=projectTamer(moonS1ProjectionView);tamer.actions.push(...tamerActions(moonS1ProjectionView));tamer.animals=tamerAnimals(moonS1ProjectionView);tamer.companionName=tamerCompanionName(moonS1ProjectionView);if(moonS1ProjectionView.progression.pathwayId==='moon'&&moonS1ProjectionView.progression.sequence===8)tamer.abilities=[...apothecary.abilities,...tamer.abilities];
  const town=projectTown(s);appendPathwayItems(s,town);if(s.warrior.practiceClub.custodian==='PLAYER')for(const a of town.actions)if(a.command.type==='EQUIP_CLUB'){a.enabled=false;a.reason='先到战士成长中归还实际借用的原训练棍。';}
  const magician=projectMagician(divinerProjectionView);magician.actions.push(...magicianActions(divinerProjectionView));magician.practices=magicianPractices(divinerProjectionView);if(s.progression.pathwayId==='diviner'&&s.progression.sequence===7)magician.abilities=[...seer.abilities,...clown.abilities,...magician.abilities];
  const pyromaniac=projectPyromaniac(hunterProjectionView);pyromaniac.actions.push(...pyromaniacActions(hunterProjectionView));pyromaniac.practices=pyromaniacPractices(hunterProjectionView);pyromaniac.environment=pyromaniacEnvironment(hunterProjectionView);if(s.progression.pathwayId==='hunter'&&s.progression.sequence===7)pyromaniac.abilities=[...hunter.abilities,...provoker.abilities,...pyromaniac.abilities];
  const psychologist=projectPsychologist(audienceProjectionView);psychologist.actions.push(...psychologistActions(audienceProjectionView));psychologist.scenes=psychologistScenes(audienceProjectionView);psychologist.environment=PSYCHOLOGIST_ENVIRONMENT;if(s.progression.pathwayId==='audience'&&s.progression.sequence===7)psychologist.abilities=[...audience.abilities,...mindreader.abilities,...psychologist.abilities];
  const appraiser=projectAppraiser(paragonProjectionView);appraiser.actions.push(...appraiserActions(paragonProjectionView));appraiser.items=appraiserItems(paragonProjectionView);appraiser.environment=APPRAISER_ENVIRONMENT;if(paragonProjectionView.progression.pathwayId==='paragon'&&paragonProjectionView.progression.sequence===7)appraiser.abilities=[...savant.abilities,...archaeologist.abilities,...appraiser.abilities];
  const vampire=projectVampire(moonS1ProjectionView);vampire.actions.push(...vampireActions(moonS1ProjectionView));vampire.practices=vampirePractices(moonS1ProjectionView);vampire.environment=VAMPIRE_ENVIRONMENT;vampire.bloodSummary=vampireBloodSummary(moonS1ProjectionView);if(moonS1ProjectionView.progression.pathwayId==='moon'&&moonS1ProjectionView.progression.sequence===7)vampire.abilities=[...apothecary.abilities,...tamer.abilities,...vampire.abilities];
  const sleepless=projectSleepless(darknessS1ProjectionView);sleepless.actions.push(...sleeplessActions(darknessS1ProjectionView));sleepless.watches=sleeplessWatches(darknessS1ProjectionView);sleepless.environment=SLEEPLESS_ENVIRONMENT;
  const midnight=projectMidnight(darknessS1ProjectionView);midnight.actions.push(...midnightActions(darknessS1ProjectionView));midnight.cases=midnightCases(darknessS1ProjectionView);midnight.environment=MIDNIGHT_ENVIRONMENT;
  const nightmare=projectNightmare(darknessS1ProjectionView);nightmare.actions.push(...nightmareActions(darknessS1ProjectionView));nightmare.cases=nightmareCases(darknessS1ProjectionView);nightmare.environment=NIGHTMARE_ENVIRONMENT;
  const reader=projectReader(whiteTowerS1ProjectionView);reader.actions.push(...readerActions(whiteTowerS1ProjectionView));reader.cases=readerCases(whiteTowerS1ProjectionView);reader.environment=READER_ENVIRONMENT;
  const reasoner=projectReasoner(whiteTowerS1ProjectionView);reasoner.actions.push(...reasonerActions(whiteTowerS1ProjectionView));reasoner.cases=reasonerCases(whiteTowerS1ProjectionView);reasoner.environment=REASONER_ENVIRONMENT;if(whiteTowerS1ProjectionView.progression.pathwayId==='white-tower'&&whiteTowerS1ProjectionView.progression.sequence===8)reasoner.abilities=[...reader.abilities,...reasoner.abilities];
  const detective=projectDetective(whiteTowerS1ProjectionView);detective.actions.push(...detectiveActions(whiteTowerS1ProjectionView));detective.cases=detectiveCases(whiteTowerS1ProjectionView);detective.environment=DETECTIVE_ENVIRONMENT;if(whiteTowerS1ProjectionView.progression.pathwayId==='white-tower'&&whiteTowerS1ProjectionView.progression.sequence===7)detective.abilities=[...reader.abilities,...reasoner.abilities,...detective.abilities];
  const sailor=projectSailor(tyrantS1ProjectionView);sailor.actions.push(...sailorActions(tyrantS1ProjectionView));sailor.cases=sailorCases(tyrantS1ProjectionView);sailor.environment=SAILOR_ENVIRONMENT;
  const rager=projectRager(tyrantS1ProjectionView);rager.actions.push(...ragerActions(tyrantS1ProjectionView));rager.cases=ragerCases(tyrantS1ProjectionView);rager.environment=RAGER_ENVIRONMENT;if(tyrantS1ProjectionView.progression.pathwayId==='tyrant'&&(tyrantS1ProjectionView.progression.sequence===8||tyrantS1ProjectionView.progression.sequence===7))rager.abilities=[...sailor.abilities,...rager.abilities];
  const navigator=projectNavigator(tyrantS1ProjectionView);navigator.actions.push(...navigatorActions(tyrantS1ProjectionView));navigator.cases=navigatorCases(tyrantS1ProjectionView);navigator.environment=NAVIGATOR_ENVIRONMENT;if(tyrantS1ProjectionView.progression.pathwayId==='tyrant'&&tyrantS1ProjectionView.progression.sequence===7)navigator.abilities=[...rager.abilities,...navigator.abilities];
  const bard=projectBard(sunS1ProjectionView);bard.actions.push(...bardActions(sunS1ProjectionView));bard.cases=bardCases(sunS1ProjectionView);bard.environment=BARD_ENVIRONMENT;
  const lightprayer=projectLightprayer(sunS1ProjectionView);lightprayer.actions.push(...lightprayerActions(sunS1ProjectionView));lightprayer.cases=lightprayerCases(sunS1ProjectionView);lightprayer.environment=LIGHTPRAYER_ENVIRONMENT;if(sunS1ProjectionView.progression.pathwayId==='sun'&&sunS1ProjectionView.progression.sequence===8)lightprayer.abilities=[...bard.abilities,...lightprayer.abilities];
  const sunpriest=projectSunpriest(sunS1ProjectionView);sunpriest.actions.push(...sunpriestActions(sunS1ProjectionView));sunpriest.cases=sunpriestCases(sunS1ProjectionView);sunpriest.environment=SUNPRIEST_ENVIRONMENT;if(sunS1ProjectionView.progression.pathwayId==='sun'&&sunS1ProjectionView.progression.sequence===7)sunpriest.abilities=[...bard.abilities,...lightprayer.abilities,...sunpriest.abilities];
  const corpsecollector=projectCorpsecollector(deathS1ProjectionView);corpsecollector.actions.push(...corpsecollectorActions(deathS1ProjectionView));corpsecollector.cases=corpsecollectorCases(deathS1ProjectionView);corpsecollector.environment=CORPSECOLLECTOR_ENVIRONMENT;
  const gravedigger=projectGravedigger(deathS1ProjectionView);gravedigger.actions.push(...gravediggerActions(deathS1ProjectionView));gravedigger.cases=gravediggerCases(deathS1ProjectionView);gravedigger.environment=GRAVEDIGGER_ENVIRONMENT;if(deathS1ProjectionView.progression.pathwayId==='death'&&deathS1ProjectionView.progression.sequence===8)gravedigger.abilities=[...corpsecollector.abilities,...gravedigger.abilities];
  const spiritmedium=projectSpiritmedium(deathS1ProjectionView);spiritmedium.actions.push(...spiritmediumActions(deathS1ProjectionView));spiritmedium.cases=spiritmediumCases(deathS1ProjectionView);spiritmedium.environment=SPIRITMEDIUM_ENVIRONMENT;if(deathS1ProjectionView.progression.pathwayId==='death'&&deathS1ProjectionView.progression.sequence===7)spiritmedium.abilities=[...corpsecollector.abilities,...gravedigger.abilities,...spiritmedium.abilities];
  const apprentice=projectApprentice(doorProjectionView);apprentice.actions.push(...apprenticeActions(doorProjectionView));apprentice.cases=apprenticeCases(doorProjectionView);apprentice.environment=APPRENTICE_ENVIRONMENT;
  const trickmaster=projectTrickmaster(doorProjectionView);trickmaster.actions.push(...trickmasterActions(doorProjectionView));trickmaster.cases=trickmasterCases(doorProjectionView);trickmaster.environment=TRICKMASTER_ENVIRONMENT;if(doorProjectionView.progression.pathwayId==='door'&&(doorProjectionView.progression.sequence===8||doorProjectionView.progression.sequence===7))trickmaster.abilities=[...apprentice.abilities,...trickmaster.abilities];
  const astrologer=projectAstrologer(doorProjectionView);astrologer.actions.push(...astrologerActions(doorProjectionView));astrologer.cases=astrologerCases(doorProjectionView);astrologer.environment=ASTROLOGER_ENVIRONMENT;if(doorProjectionView.progression.pathwayId==='door'&&doorProjectionView.progression.sequence===7)astrologer.abilities=[...trickmaster.abilities,...astrologer.abilities];
  const marauder=projectMarauder(errorProjectionView);marauder.actions.push(...marauderActions(errorProjectionView),...marauderDisputeActions(errorProjectionView));marauder.cases=marauderCases(errorProjectionView);marauder.originals=marauderOriginals(errorProjectionView);marauder.environment=MARAUDER_ENVIRONMENT;
  const swindler=projectSwindler(errorProjectionView);swindler.actions.push(...swindlerActions(errorProjectionView));if(errorProjectionView.progression.pathwayId==='error'&&errorProjectionView.progression.sequence===8)for(const a of marauderDisputeActions(errorProjectionView)){if(a.command.type==='RETURN_TOOL')swindler.actions.push({...a,command:{type:'RETURN_TOOL'}});}swindler.cases=swindlerCases(errorProjectionView);swindler.environment=SWINDLER_ENVIRONMENT;if(errorProjectionView.progression.pathwayId==='error'&&errorProjectionView.progression.sequence===8)swindler.abilities=[...marauder.abilities,...swindler.abilities];
  const cryptologist=projectCryptologist(errorProjectionView);cryptologist.actions.push(...cryptologistActions(errorProjectionView));cryptologist.cases=cryptologistCases(errorProjectionView);cryptologist.environment=CRYPTOLOGIST_ENVIRONMENT;if(errorProjectionView.progression.pathwayId==='error'&&errorProjectionView.progression.sequence===7){cryptologist.abilities=[...marauder.abilities,...swindler.abilities,...cryptologist.abilities];for(const a of marauderDisputeActions(errorProjectionView))if(a.command.type==='RETURN_TOOL')cryptologist.actions.push({...a,command:{type:'RETURN_TOOL'}});}
  const warrior=projectWarrior(s);warrior.actions.push(...warriorActions(s));warrior.cases=warriorCases(s);warrior.tool=warriorTool(s);warrior.environment=WARRIOR_ENVIRONMENT;
  const gladiator=projectGladiator(s);gladiator.actions.push(...gladiatorActions(s));gladiator.cases=gladiatorCases(s);gladiator.environment=GLADIATOR_ENVIRONMENT;gladiator.insideCase=gladiatorInside(s);if(s.progression.pathwayId==='warrior'&&s.progression.sequence===8)gladiator.abilities=[...warrior.abilities,...gladiator.abilities];
  const weaponmaster=projectWeaponmaster(s);weaponmaster.actions.push(...weaponmasterActions(s));weaponmaster.cases=weaponmasterCases(s);weaponmaster.environment=WEAPONMASTER_ENVIRONMENT;if(s.progression.pathwayId==='warrior'&&s.progression.sequence===7)weaponmaster.abilities=[...warrior.abilities,...gladiator.abilities,...weaponmaster.abilities];
  const assassin=projectAssassin(s);assassin.actions.push(...assassinActions(s));assassin.cases=assassinCases(s);assassin.environment=ASSASSIN_ENVIRONMENT;assassin.insideCase=assassinInside(s);assassin.draft=assassinDraft(s);
  const instigator=projectInstigator(s);instigator.actions.push(...instigatorActions(s));instigator.cases=instigatorCases(s);instigator.environment=INSTIGATOR_ENVIRONMENT;instigator.insideCase=instigatorInside(s);if(s.progression.pathwayId==='demoness'&&s.progression.sequence===8)instigator.abilities=[...assassin.abilities,...instigator.abilities];
  const witch=projectWitch(s);witch.actions.push(...witchActions(s));witch.cases=witchCases(s);witch.environment=WITCH_ENVIRONMENT;if(s.progression.pathwayId==='demoness'&&s.progression.sequence===7)witch.abilities=[...assassin.abilities,...instigator.abilities,...witch.abilities];
  const pryer=projectPryer(s);pryer.actions.push(...pryerActions(s));pryer.cases=pryerCases(s);pryer.environment=PRYER_ENVIRONMENT;pryer.insideCase=pryerInside(s);
  const combatScholar=projectCombatScholar(s);combatScholar.actions.push(...combatScholarActions(s));combatScholar.cases=combatScholarCases(s);combatScholar.environment=COMBAT_SCHOLAR_ENVIRONMENT;combatScholar.insideCase=combatScholarInside(s);
  const wizard=projectWizard(s);wizard.actions.push(...wizardActions(s));wizard.cases=wizardCases(s);wizard.lessons=wizardLessons(s);wizard.environment=WIZARD_ENVIRONMENT;wizard.insideCase=wizardInside(s);
  const secretSupplicant=projectSecretSupplicant(s);secretSupplicant.actions.push(...secretSupplicantActions(s));secretSupplicant.cases=secretSupplicantCases(s);secretSupplicant.environment=SECRET_SUPPLICANT_ENVIRONMENT;secretSupplicant.insideCase=secretSupplicantInside(s);
  const listener=projectListener(s);listener.actions.push(...listenerActions(s));listener.cases=listenerCases(s);listener.environment=LISTENER_ENVIRONMENT;listener.insideCase=listenerInside(s);
  const shadowAscetic=projectShadowAscetic(s);shadowAscetic.actions.push(...shadowAsceticActions(s));shadowAscetic.cases=shadowAsceticCases(s);shadowAscetic.environment=SHADOW_ASCETIC_ENVIRONMENT;shadowAscetic.insideCase=shadowAsceticInside(s);
  const criminal=projectCriminal(s);criminal.actions.push(...criminalActions(s));criminal.cases=criminalCases(s);criminal.environment=CRIMINAL_ENVIRONMENT;criminal.insideCase=criminalInside(s);
  const unwinged=projectUnwinged(s);unwinged.actions.push(...unwingedActions(s));unwinged.cases=unwingedCases(s);unwinged.environment=UNWINGED_ENVIRONMENT;unwinged.insideCase=unwingedInside(s);
  const serialKiller=projectSerialKiller(s);serialKiller.actions.push(...serialKillerActions(s));serialKiller.cases=serialKillerCases(s);serialKiller.environment=SERIAL_KILLER_ENVIRONMENT;serialKiller.insideCase=serialKillerInside(s);
  const motherProjectionView=natureWalkerInheritedView(s);
  const justiciarProjectionView=handOfOrderInheritedView(s);
  const blackEmperorProjectionView=princeOfAbolitionInheritedView(s);
  const wheelProjectionView=mercurySnakeInheritedView(s);
  const chainedProjectionView=abominationInheritedView(s);
  const prisoner=projectPrisoner(chainedProjectionView);prisoner.actions.push(...prisonerActions(chainedProjectionView));prisoner.cases=prisonerCases(chainedProjectionView);prisoner.environment=PRISONER_ENVIRONMENT;prisoner.insideCase=prisonerInside(chainedProjectionView);
  const madman=projectMadman(chainedProjectionView);madman.actions.push(...madmanActions(chainedProjectionView));madman.cases=madmanCases(chainedProjectionView);madman.environment=MADMAN_ENVIRONMENT;madman.insideCase=madmanInside(chainedProjectionView);
  const werewolf=projectWerewolf(chainedProjectionView);werewolf.actions.push(...werewolfActions(chainedProjectionView));werewolf.cases=werewolfCases(chainedProjectionView);werewolf.environment=WEREWOLF_ENVIRONMENT;werewolf.insideCase=werewolfInside(chainedProjectionView);
  const monster=projectMonster(wheelProjectionView);monster.actions.push(...monsterActions(wheelProjectionView));monster.cases=monsterCases(wheelProjectionView);monster.environment=MONSTER_ENVIRONMENT;monster.insideCase=monsterInside(wheelProjectionView);
  const machine=projectMachine(wheelProjectionView);machine.actions.push(...machineActions(wheelProjectionView));machine.cases=machineCases(wheelProjectionView);machine.environment=MACHINE_ENVIRONMENT;machine.insideCase=machineInside(wheelProjectionView);
  const lucky=projectLucky(wheelProjectionView);lucky.actions.push(...luckyActions(wheelProjectionView));lucky.cases=luckyCases(wheelProjectionView);lucky.environment=LUCKY_ENVIRONMENT;lucky.insideCase=luckyInside(wheelProjectionView);
  const lawyer=projectLawyer(blackEmperorProjectionView);lawyer.actions.push(...lawyerActions(blackEmperorProjectionView));lawyer.cases=lawyerCases(blackEmperorProjectionView);lawyer.environment=LAWYER_ENVIRONMENT;lawyer.insideCase=lawyerInside(blackEmperorProjectionView);
  const barbarian=projectBarbarian(blackEmperorProjectionView);barbarian.actions.push(...barbarianActions(blackEmperorProjectionView));barbarian.cases=barbarianCases(blackEmperorProjectionView);barbarian.environment=BARBARIAN_ENVIRONMENT;barbarian.insideCase=barbarianInside(blackEmperorProjectionView);if(s.progression.pathwayId==='black-emperor'&&s.progression.sequence===8)barbarian.abilities=[...lawyer.abilities,...barbarian.abilities];
  const briber=projectBriber(blackEmperorProjectionView);briber.actions.push(...briberActions(blackEmperorProjectionView));briber.cases=briberCases(blackEmperorProjectionView);briber.environment=BRIBER_ENVIRONMENT;briber.insideCase=briberInside(blackEmperorProjectionView);briber.gifts={held:s.briber.gifts.filter(g=>g.location==='PLAYER').length,given:s.briber.gifts.filter(g=>g.location==='GIVEN').length,summary:'只有实际购买且仍随身的原木筹可再次给出。已给原物留在实际给予地点或本场地面，结束和战后均不自动返还。'};if(s.progression.pathwayId==='black-emperor'&&s.progression.sequence===7)briber.abilities=[...lawyer.abilities,...barbarian.abilities,...briber.abilities];
  const arbiter=projectArbiter(justiciarProjectionView);arbiter.actions.push(...arbiterActions(justiciarProjectionView));arbiter.cases=arbiterCases(justiciarProjectionView);arbiter.environment=ARBITER_ENVIRONMENT;arbiter.insideCase=arbiterInside(justiciarProjectionView);
  const sheriff=projectSheriff(justiciarProjectionView);if(s.progression.pathwayId==='justiciar'&&s.progression.sequence===8)sheriff.abilities.unshift(...ARBITER_ABILITIES.map(a=>({...a,mastery:s.progression.mastery[a.id]??0,description:a.id==='justiciar.s9.combat-training'?'保留仲裁人时期的格斗训练，持械仍使用真实当前装备。':a.description})));sheriff.actions.push(...sheriffActions(justiciarProjectionView));sheriff.cases=sheriffCases(justiciarProjectionView);sheriff.environment=SHERIFF_ENVIRONMENT;sheriff.insideCase=sheriffInside(justiciarProjectionView);
  const interrogator=projectInterrogator(justiciarProjectionView);if(s.progression.pathwayId==='justiciar'&&s.progression.sequence===7)interrogator.abilities.unshift(...[...ARBITER_ABILITIES,...SHERIFF_ABILITIES].map(a=>({...a,mastery:s.progression.mastery[a.id]??0,description:a.id==='justiciar.s9.combat-training'?'保留仲裁人时期的格斗训练，持械仍使用真实当前装备。':a.description})));interrogator.actions.push(...interrogatorActions(justiciarProjectionView));interrogator.cases=interrogatorCases(justiciarProjectionView);interrogator.environment=INTERROGATOR_ENVIRONMENT;interrogator.insideCase=interrogatorInside(justiciarProjectionView);
  const cultivator=projectCultivator(motherProjectionView);cultivator.actions.push(...cultivatorActions(motherProjectionView));cultivator.cases=cultivatorCases(motherProjectionView);cultivator.environment=CULTIVATOR_ENVIRONMENT;cultivator.garden=cultivatorGarden(motherProjectionView);cultivator.insideCase=cultivatorInside(natureWalkerInheritedView(s));
  const physician=projectPhysician(motherProjectionView);if(s.progression.pathwayId==='mother'&&s.progression.sequence===8)physician.abilities.unshift(...CULTIVATOR_ABILITIES.map(a=>({...a,mastery:s.progression.mastery[a.id]??0}))); physician.actions.push(...physicianActions(motherProjectionView));physician.cases=physicianCases(motherProjectionView);physician.environment=PHYSICIAN_ENVIRONMENT;physician.clinic=physicianClinic(motherProjectionView);physician.insideCase=physicianInside(natureWalkerInheritedView(s));
  const harvestpriest=projectHarvestpriest(motherProjectionView);if(s.progression.pathwayId==='mother'&&s.progression.sequence===7)harvestpriest.abilities.unshift(...[...CULTIVATOR_ABILITIES,...PHYSICIAN_ABILITIES].map(a=>({...a,mastery:s.progression.mastery[a.id]??0})));harvestpriest.actions.push(...harvestpriestActions(motherProjectionView));harvestpriest.cases=harvestpriestCases(motherProjectionView);harvestpriest.environment=HARVESTPRIEST_ENVIRONMENT;harvestpriest.plot=harvestpriestPlot(motherProjectionView);harvestpriest.insideCase=harvestpriestInside(natureWalkerInheritedView(s));
  const faceless=projectFaceless(divinerProjectionView);if(s.progression.pathwayId==='diviner'&&(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3)))faceless.abilities.unshift(...seer.abilities,...clown.abilities,...magician.abilities);
  const conspirator=projectConspirator(hunterProjectionView);conspirator.actions.push(...conspiratorActions(hunterProjectionView));conspirator.cases=conspiratorCases(hunterProjectionView);conspirator.insideCase=conspiratorInside(hunterProjectionView);conspirator.environment=CONSPIRATOR_ENVIRONMENT;if(s.progression.pathwayId==='hunter'&&(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))))conspirator.abilities.unshift(...hunter.abilities,...provoker.abilities,...pyromaniac.abilities);
  const hypnotist=projectHypnotist(audienceProjectionView);hypnotist.actions.push(...hypnotistActions(audienceProjectionView));hypnotist.cases=hypnotistCases(audienceProjectionView);hypnotist.insideCase=hypnotistInside(audienceProjectionView);hypnotist.environment=HYPNOTIST_ENVIRONMENT;if(s.progression.pathwayId==='audience'&&(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))))hypnotist.abilities.unshift(...audience.abilities,...mindreader.abilities,...psychologist.abilities);
  const artisan=projectArtisan(paragonProjectionView);artisan.actions.push(...artisanActions(paragonProjectionView));artisan.cases=artisanCases(paragonProjectionView);artisan.insideCase=artisanInside(paragonProjectionView);artisan.environment=ARTISAN_ENVIRONMENT;if(paragonProjectionView.progression.pathwayId==='paragon'&&(paragonProjectionView.progression.sequence===6||paragonProjectionView.progression.sequence===5||(paragonProjectionView.progression.sequence===4||(paragonProjectionView.progression.sequence===3||(paragonProjectionView.progression.sequence===2||paragonProjectionView.progression.sequence===1)))))artisan.abilities.unshift(...savant.abilities,...archaeologist.abilities,...appraiser.abilities);
  const potionProfessor=projectPotionProfessor(moonS1ProjectionView);potionProfessor.actions.push(...potionProfessorActions(moonS1ProjectionView));potionProfessor.cases=potionProfessorCases(moonS1ProjectionView);potionProfessor.insideCase=potionProfessorInside(moonS1ProjectionView);potionProfessor.environment=POTION_PROFESSOR_ENVIRONMENT;if(moonS1ProjectionView.progression.pathwayId==='moon'&&(moonS1ProjectionView.progression.sequence===6||moonS1ProjectionView.progression.sequence===5||(moonS1ProjectionView.progression.sequence===4||(moonS1ProjectionView.progression.sequence===3||(moonS1ProjectionView.progression.sequence===2||moonS1ProjectionView.progression.sequence===1)))))potionProfessor.abilities.unshift(...apothecary.abilities,...tamer.abilities,...vampire.abilities);
  const soother=projectSoother(darknessS1ProjectionView);soother.actions.push(...sootherActions(darknessS1ProjectionView));soother.cases=sootherCases(darknessS1ProjectionView);soother.insideCase=sootherInside(darknessS1ProjectionView);soother.environment=SOOTHER_ENVIRONMENT;if(darknessS1ProjectionView.progression.pathwayId==='darkness'&&(darknessS1ProjectionView.progression.sequence===6||darknessS1ProjectionView.progression.sequence===5||(darknessS1ProjectionView.progression.sequence===4||(darknessS1ProjectionView.progression.sequence===3||(darknessS1ProjectionView.progression.sequence===2||darknessS1ProjectionView.progression.sequence===1)))))soother.abilities.unshift(...sleepless.abilities,...midnight.abilities,...nightmare.abilities);
  const polymath=projectPolymath(whiteTowerS1ProjectionView);polymath.actions.push(...polymathActions(whiteTowerS1ProjectionView));polymath.cases=polymathCases(whiteTowerS1ProjectionView);polymath.insideCase=polymathInside(whiteTowerS1ProjectionView);polymath.environment=POLYMATH_ENVIRONMENT;if(whiteTowerS1ProjectionView.progression.pathwayId==='white-tower'&&(whiteTowerS1ProjectionView.progression.sequence===6||whiteTowerS1ProjectionView.progression.sequence===5||(whiteTowerS1ProjectionView.progression.sequence===4||(whiteTowerS1ProjectionView.progression.sequence===3||(whiteTowerS1ProjectionView.progression.sequence===2||whiteTowerS1ProjectionView.progression.sequence===1)))))polymath.abilities.unshift(...reader.abilities,...reasoner.abilities,...detective.abilities);
  const windBlessed=projectWindBlessed(tyrantS1ProjectionView);windBlessed.actions.push(...windBlessedActions(tyrantS1ProjectionView));windBlessed.cases=windBlessedCases(tyrantS1ProjectionView);windBlessed.insideCase=windBlessedInside(tyrantS1ProjectionView);windBlessed.environment=WIND_BLESSED_ENVIRONMENT;if(tyrantS1ProjectionView.progression.pathwayId==='tyrant'&&(tyrantS1ProjectionView.progression.sequence===6||tyrantS1ProjectionView.progression.sequence===5||(tyrantS1ProjectionView.progression.sequence===4||(tyrantS1ProjectionView.progression.sequence===3||(tyrantS1ProjectionView.progression.sequence===2||tyrantS1ProjectionView.progression.sequence===1)))))windBlessed.abilities.unshift(...sailor.abilities,...rager.abilities,...navigator.abilities);
  const notary=projectNotary(sunS1ProjectionView);notary.cases=notaryCases(sunS1ProjectionView);notary.insideCase=notaryInside(sunS1ProjectionView);notary.environment=NOTARY_ENVIRONMENT;if(sunS1ProjectionView.progression.pathwayId==='sun'&&(sunS1ProjectionView.progression.sequence===6||sunS1ProjectionView.progression.sequence===5||(sunS1ProjectionView.progression.sequence===4||(sunS1ProjectionView.progression.sequence===3||(sunS1ProjectionView.progression.sequence===2||sunS1ProjectionView.progression.sequence===1)))))notary.abilities.unshift(...bard.abilities,...lightprayer.abilities,...sunpriest.abilities);
  const spiritGuide=projectSpiritGuide(deathS1ProjectionView);spiritGuide.actions.push(...spiritGuideActions(deathS1ProjectionView));spiritGuide.cases=spiritGuideCases(deathS1ProjectionView);spiritGuide.insideCase=spiritGuideInside(deathS1ProjectionView);spiritGuide.environment=SPIRIT_GUIDE_ENVIRONMENT;if(deathS1ProjectionView.progression.pathwayId==='death'&&(deathS1ProjectionView.progression.sequence===6||deathS1ProjectionView.progression.sequence===5||(deathS1ProjectionView.progression.sequence===4||(deathS1ProjectionView.progression.sequence===3||(deathS1ProjectionView.progression.sequence===2||deathS1ProjectionView.progression.sequence===1)))))spiritGuide.abilities.unshift(...corpsecollector.abilities,...gravedigger.abilities,...spiritmedium.abilities);
  const recorder=projectRecorder(doorProjectionView);recorder.actions.push(...recorderActions(doorProjectionView));recorder.cases=recorderCases(doorProjectionView);recorder.insideCase=recorderInside(doorProjectionView);recorder.environment=RECORDER_ENVIRONMENT;if(doorProjectionView.progression.pathwayId==='door'&&(doorProjectionView.progression.sequence===6||doorProjectionView.progression.sequence===5||doorProjectionView.progression.sequence===4||(doorProjectionView.progression.sequence===3||doorProjectionView.progression.sequence===2)))recorder.abilities.unshift(...apprentice.abilities,...trickmaster.abilities,...astrologer.abilities);
  const fireThief=projectFireThief(errorProjectionView);fireThief.actions.push(...fireThiefActions(errorProjectionView));fireThief.cases=fireThiefCases(errorProjectionView);fireThief.insideCase=fireThiefInside(errorProjectionView);fireThief.environment=FIRE_THIEF_ENVIRONMENT;if(errorProjectionView.progression.pathwayId==='error'&&(errorProjectionView.progression.sequence===6||errorProjectionView.progression.sequence===5||(errorProjectionView.progression.sequence===4||(errorProjectionView.progression.sequence===3||errorProjectionView.progression.sequence===2))))fireThief.abilities.unshift(...marauder.abilities,...swindler.abilities,...cryptologist.abilities);
  const dawnPaladin=projectDawnPaladin(s);dawnPaladin.actions.push(...dawnPaladinActions(s));dawnPaladin.cases=dawnPaladinCases(s);dawnPaladin.insideCase=dawnPaladinInside(s);dawnPaladin.environment=DAWN_PALADIN_ENVIRONMENT;if(s.progression.pathwayId==='warrior'&&(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))dawnPaladin.abilities.unshift(...warrior.abilities,...gladiator.abilities,...weaponmaster.abilities);
  const pleasure=projectPleasure(s);pleasure.cases=pleasureCases(s);pleasure.insideCase=pleasureInside(s);pleasure.environment=PLEASURE_ENVIRONMENT;if(s.progression.pathwayId==='demoness'&&(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))pleasure.abilities.unshift(...assassin.abilities,...instigator.abilities,...witch.abilities);
  const scrollProfessor=projectScrollProfessor(s);scrollProfessor.actions.push(...scrollProfessorActions(s));scrollProfessor.cases=scrollProfessorCases(s);scrollProfessor.insideCase=scrollProfessorInside(s);scrollProfessor.environment=SCROLL_PROFESSOR_ENVIRONMENT;if(s.progression.pathwayId==='hermit'&&(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3)))scrollProfessor.abilities.unshift(...pryer.abilities,...combatScholar.abilities,...wizard.abilities);
  const roseBishop=projectRoseBishop(s);roseBishop.actions.push(...roseBishopActions(s));roseBishop.cases=roseBishopCases(s);roseBishop.insideCase=roseBishopInside(s);roseBishop.environment=ROSE_BISHOP_ENVIRONMENT;if(s.progression.pathwayId==='hanged-man'&&(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))roseBishop.abilities.unshift(...secretSupplicant.abilities,...listener.abilities,...shadowAscetic.abilities);
  const demon=projectDemon(s);demon.actions.push(...demonActions(s));demon.cases=demonCases(s);demon.insideCase=demonInside(s);demon.environment=DEMON_ENVIRONMENT;if(s.progression.pathwayId==='abyss'&&(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3)))demon.abilities.unshift(...criminal.abilities,...unwinged.abilities,...serialKiller.abilities);
  const zombie=projectZombie(chainedProjectionView);zombie.actions.push(...zombieActions(chainedProjectionView));zombie.cases=zombieCases(chainedProjectionView);zombie.insideCase=zombieInside(chainedProjectionView);zombie.environment=ZOMBIE_ENVIRONMENT;if(s.progression.pathwayId==='chained'&&(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3)))zombie.abilities.unshift(...prisoner.abilities,...madman.abilities,...werewolf.abilities);
  const calamityPriest=projectCalamityPriest(wheelProjectionView);calamityPriest.actions.push(...calamityPriestActions(wheelProjectionView));calamityPriest.cases=calamityPriestCases(wheelProjectionView);calamityPriest.insideCase=calamityPriestInside(wheelProjectionView);calamityPriest.environment=CALAMITY_PRIEST_ENVIRONMENT;if(s.progression.pathwayId==='wheel'&&(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3)))calamityPriest.abilities.unshift(...monster.abilities,...machine.abilities,...lucky.abilities);
  const corruptionBaron=projectCorruptionBaron(blackEmperorProjectionView);corruptionBaron.actions.push(...corruptionBaronActions(blackEmperorProjectionView));corruptionBaron.cases=corruptionBaronCases(blackEmperorProjectionView);corruptionBaron.insideCase=corruptionBaronInside(blackEmperorProjectionView);corruptionBaron.environment=CORRUPTION_BARON_ENVIRONMENT;if(s.progression.pathwayId==='black-emperor'&&(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3)))corruptionBaron.abilities.unshift(...lawyer.abilities,...barbarian.abilities,...briber.abilities);
  const judge=projectJudge(justiciarProjectionView);judge.actions.push(...judgeActions(justiciarProjectionView));judge.cases=judgeCases(justiciarProjectionView);judge.insideCase=judgeInside(justiciarProjectionView);judge.environment=JUDGE_ENVIRONMENT;if(s.progression.pathwayId==='justiciar'&&(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))judge.abilities.unshift(...arbiter.abilities,...sheriff.abilities,...interrogator.abilities);
  const biologist=projectBiologist(motherProjectionView);biologist.actions.push(...biologistActions(motherProjectionView));biologist.cases=biologistCases(motherProjectionView);biologist.insideCase=biologistInside(natureWalkerInheritedView(s));biologist.environment=BIOLOGIST_ENVIRONMENT;if(s.progression.pathwayId==='mother'&&(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))biologist.abilities.unshift(...cultivator.abilities,...physician.abilities,...harvestpriest.abilities);
  const marionettist=projectMarionettist(divinerProjectionView);if(s.progression.pathwayId==='diviner'&&(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3)))marionettist.abilities.unshift(...faceless.abilities);
  const reaper=projectReaper(hunterProjectionView);reaper.actions.push(...reaperActions(hunterProjectionView));reaper.cases=reaperCases(hunterProjectionView);reaper.insideCase=reaperInside(hunterProjectionView);reaper.environment=REAPER_ENVIRONMENT;if(s.progression.pathwayId==='hunter'&&(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))))reaper.abilities.unshift(...conspirator.abilities);
  const dreamwalker=projectDreamwalker(audienceProjectionView);dreamwalker.actions.push(...dreamwalkerActions(audienceProjectionView));dreamwalker.cases=dreamwalkerCases(audienceProjectionView);dreamwalker.insideCase=dreamwalkerInside(audienceProjectionView);dreamwalker.environment=DREAMWALKER_ENVIRONMENT;if(s.progression.pathwayId==='audience'&&(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))))dreamwalker.abilities.unshift(...hypnotist.abilities);
  const astronomer=projectAstronomer(paragonProjectionView);astronomer.actions.push(...astronomerActions(paragonProjectionView));astronomer.cases=astronomerCases(paragonProjectionView);astronomer.insideCase=astronomerInside(paragonProjectionView);astronomer.environment=ASTRONOMER_ENVIRONMENT;if(paragonProjectionView.progression.pathwayId==='paragon'&&(paragonProjectionView.progression.sequence===5||(paragonProjectionView.progression.sequence===4||(paragonProjectionView.progression.sequence===3||(paragonProjectionView.progression.sequence===2||paragonProjectionView.progression.sequence===1)))))astronomer.abilities.unshift(...artisan.abilities);
  const crimsonScholar=projectCrimsonScholar(moonS1ProjectionView);crimsonScholar.actions.push(...crimsonScholarActions(moonS1ProjectionView));crimsonScholar.cases=crimsonScholarCases(moonS1ProjectionView);crimsonScholar.insideCase=crimsonScholarInside(moonS1ProjectionView);crimsonScholar.environment=CRIMSON_SCHOLAR_ENVIRONMENT;if(moonS1ProjectionView.progression.pathwayId==='moon'&&(moonS1ProjectionView.progression.sequence===5||(moonS1ProjectionView.progression.sequence===4||(moonS1ProjectionView.progression.sequence===3||(moonS1ProjectionView.progression.sequence===2||moonS1ProjectionView.progression.sequence===1)))))crimsonScholar.abilities.unshift(...potionProfessor.abilities);
  const spiritWarlock=projectSpiritWarlock(darknessS1ProjectionView);spiritWarlock.actions.push(...spiritWarlockActions(darknessS1ProjectionView));spiritWarlock.cases=spiritWarlockCases(darknessS1ProjectionView);spiritWarlock.companion=spiritWarlockCompanion(darknessS1ProjectionView);spiritWarlock.practice=spiritWarlockPractice(darknessS1ProjectionView);spiritWarlock.insideCase=spiritWarlockInside(darknessS1ProjectionView);spiritWarlock.environment=SPIRIT_WARLOCK_ENVIRONMENT;if(darknessS1ProjectionView.progression.pathwayId==='darkness'&&(darknessS1ProjectionView.progression.sequence===5||(darknessS1ProjectionView.progression.sequence===4||(darknessS1ProjectionView.progression.sequence===3||(darknessS1ProjectionView.progression.sequence===2||darknessS1ProjectionView.progression.sequence===1)))))spiritWarlock.abilities.unshift(...soother.abilities);
  const mysticismMagister=projectMysticismMagister(whiteTowerS1ProjectionView);mysticismMagister.actions.push(...mysticismMagisterActions(whiteTowerS1ProjectionView));mysticismMagister.cases=mysticismMagisterCases(whiteTowerS1ProjectionView);mysticismMagister.practice=mysticismMagisterPractice(whiteTowerS1ProjectionView);mysticismMagister.crafts=mysticismMagisterCrafts(whiteTowerS1ProjectionView);mysticismMagister.insideCase=mysticismMagisterInside(whiteTowerS1ProjectionView);mysticismMagister.environment=MYSTICISM_MAGISTER_ENVIRONMENT;if(whiteTowerS1ProjectionView.progression.pathwayId==='white-tower'&&(whiteTowerS1ProjectionView.progression.sequence===5||(whiteTowerS1ProjectionView.progression.sequence===4||(whiteTowerS1ProjectionView.progression.sequence===3||(whiteTowerS1ProjectionView.progression.sequence===2||whiteTowerS1ProjectionView.progression.sequence===1)))))mysticismMagister.abilities.unshift(...polymath.abilities);
  const oceanSinger=projectOceanSinger(tyrantS1ProjectionView);oceanSinger.actions.push(...oceanSingerActions(tyrantS1ProjectionView));oceanSinger.cases=oceanSingerCases(tyrantS1ProjectionView);oceanSinger.insideCase=oceanSingerInside(tyrantS1ProjectionView);oceanSinger.environment=OCEAN_SINGER_ENVIRONMENT;oceanSinger.practice=oceanSingerPractice(tyrantS1ProjectionView);if(tyrantS1ProjectionView.progression.pathwayId==='tyrant'&&(tyrantS1ProjectionView.progression.sequence===5||(tyrantS1ProjectionView.progression.sequence===4||(tyrantS1ProjectionView.progression.sequence===3||(tyrantS1ProjectionView.progression.sequence===2||tyrantS1ProjectionView.progression.sequence===1)))))oceanSinger.abilities.unshift(...windBlessed.abilities);
  const priestOfLight=projectPriestOfLight(sunS1ProjectionView);priestOfLight.actions.push(...priestOfLightActions(sunS1ProjectionView));priestOfLight.cases=priestOfLightCases(sunS1ProjectionView);priestOfLight.insideCase=priestOfLightInside(sunS1ProjectionView);priestOfLight.environment=PRIEST_OF_LIGHT_ENVIRONMENT;priestOfLight.practice=priestOfLightPractice(sunS1ProjectionView);if(sunS1ProjectionView.progression.pathwayId==='sun'&&(sunS1ProjectionView.progression.sequence===5||(sunS1ProjectionView.progression.sequence===4||(sunS1ProjectionView.progression.sequence===3||(sunS1ProjectionView.progression.sequence===2||sunS1ProjectionView.progression.sequence===1)))))priestOfLight.abilities.unshift(...notary.abilities);
  const gatekeeper=projectGatekeeper(deathS1ProjectionView);gatekeeper.actions.push(...gatekeeperActions(deathS1ProjectionView));gatekeeper.cases=gatekeeperCases(deathS1ProjectionView);gatekeeper.insideCase=gatekeeperInside(deathS1ProjectionView);gatekeeper.environment=GATEKEEPER_ENVIRONMENT;gatekeeper.practice=gatekeeperPractice(deathS1ProjectionView);gatekeeper.companion=gatekeeperCompanion(deathS1ProjectionView);if(deathS1ProjectionView.progression.pathwayId==='death'&&(deathS1ProjectionView.progression.sequence===5||(deathS1ProjectionView.progression.sequence===4||(deathS1ProjectionView.progression.sequence===3||(deathS1ProjectionView.progression.sequence===2||deathS1ProjectionView.progression.sequence===1)))))gatekeeper.abilities.unshift(...spiritGuide.abilities);
  const traveler=projectTraveler(doorProjectionView);traveler.actions.push(...travelerActions(doorProjectionView));traveler.cases=travelerCases(doorProjectionView);traveler.insideCase=travelerInside(doorProjectionView);traveler.environment=TRAVELER_ENVIRONMENT;traveler.practice=travelerPractice(doorProjectionView);if(doorProjectionView.progression.pathwayId==='door'&&(doorProjectionView.progression.sequence===5||doorProjectionView.progression.sequence===4||(doorProjectionView.progression.sequence===3||doorProjectionView.progression.sequence===2)))traveler.abilities.unshift(...recorder.abilities);
  const dreamStealer=projectDreamStealer(errorProjectionView);dreamStealer.actions.push(...dreamStealerActions(errorProjectionView));dreamStealer.cases=dreamStealerCases(errorProjectionView);dreamStealer.insideCase=dreamStealerInside(errorProjectionView);dreamStealer.environment=DREAM_STEALER_ENVIRONMENT;dreamStealer.practice=dreamStealerPractice(errorProjectionView);if(errorProjectionView.progression.pathwayId==='error'&&(errorProjectionView.progression.sequence===5||(errorProjectionView.progression.sequence===4||(errorProjectionView.progression.sequence===3||errorProjectionView.progression.sequence===2))))dreamStealer.abilities.unshift(...fireThief.abilities);
  const guardian=projectGuardian(s);guardian.actions.push(...guardianActions(s));guardian.cases=guardianCases(s);guardian.insideCase=guardianInside(s);guardian.environment=GUARDIAN_ENVIRONMENT;guardian.practice=guardianPractice(s);if(s.progression.pathwayId==='warrior'&&(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))guardian.abilities.unshift(...dawnPaladin.abilities);
  const pain=projectPain(s);pain.actions.push(...painActions(s));pain.cases=painCases(s);pain.insideCase=painInside(s);pain.environment=PAIN_ENVIRONMENT;pain.practice=painPractice(s);if(s.progression.pathwayId==='demoness'&&(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))pain.abilities.unshift(...pleasure.abilities);
  const starMystic=projectStarMystic(s);starMystic.actions.push(...starMysticActions(s));starMystic.cases=starMysticCases(s);starMystic.insideCase=starMysticInside(s);starMystic.environment=STAR_MYSTIC_ENVIRONMENT;starMystic.practice=starMysticPractice(s);if(s.progression.pathwayId==='hermit'&&(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3)))starMystic.abilities.unshift(...scrollProfessor.abilities);
  const shepherd=projectShepherd(s);shepherd.actions.push(...shepherdActions(s));shepherd.cases=shepherdCases(s);shepherd.insideCase=shepherdInside(s);shepherd.environment=SHEPHERD_ENVIRONMENT;shepherd.practice=shepherdPractice(s);shepherd.grazing=shepherdGrazing(s);if(s.progression.pathwayId==='hanged-man'&&(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))shepherd.abilities.unshift(...roseBishop.abilities);
  const desireApostle=projectDesireApostle(s);desireApostle.actions.push(...desireApostleActions(s));desireApostle.cases=desireApostleCases(s);desireApostle.insideCase=desireApostleInside(s);desireApostle.environment=DESIRE_APOSTLE_ENVIRONMENT;desireApostle.practice=desireApostlePractice(s);if(s.progression.pathwayId==='abyss'&&(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3)))desireApostle.abilities.unshift(...demon.abilities);
  const wraith=projectWraith(chainedProjectionView);wraith.actions.push(...wraithActions(chainedProjectionView));wraith.cases=wraithCases(chainedProjectionView);wraith.insideCase=wraithInside(chainedProjectionView);wraith.environment=WRAITH_ENVIRONMENT;wraith.practice=wraithPractice(chainedProjectionView);if(s.progression.pathwayId==='chained'&&(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3)))wraith.abilities.unshift(...zombie.abilities);
  const winner=projectWinner(wheelProjectionView);winner.actions.push(...winnerActions(wheelProjectionView));winner.cases=winnerCases(wheelProjectionView);winner.insideCase=winnerInside(wheelProjectionView);winner.environment=WINNER_ENVIRONMENT;winner.practice=winnerPractice(wheelProjectionView);if(s.progression.pathwayId==='wheel'&&(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3)))winner.abilities.unshift(...calamityPriest.abilities);
  const mentorDisorder=projectMentorDisorder(blackEmperorProjectionView);mentorDisorder.actions.push(...mentorDisorderActions(blackEmperorProjectionView));mentorDisorder.cases=mentorDisorderCases(blackEmperorProjectionView);mentorDisorder.insideCase=mentorDisorderInside(blackEmperorProjectionView);mentorDisorder.environment=MENTOR_DISORDER_ENVIRONMENT;mentorDisorder.practice=mentorDisorderPractice(blackEmperorProjectionView);if(s.progression.pathwayId==='black-emperor'&&(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3)))mentorDisorder.abilities.unshift(...corruptionBaron.abilities);
  const punishmentKnight=projectPunishmentKnight(justiciarProjectionView);punishmentKnight.actions.push(...punishmentKnightActions(justiciarProjectionView));punishmentKnight.cases=punishmentKnightCases(justiciarProjectionView);punishmentKnight.insideCase=punishmentKnightInside(justiciarProjectionView);punishmentKnight.environment=PUNISHMENT_KNIGHT_ENVIRONMENT;punishmentKnight.practice=punishmentKnightPractice(justiciarProjectionView);if(s.progression.pathwayId==='justiciar'&&(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))punishmentKnight.abilities.unshift(...judge.abilities);
  const druid=projectDruid(motherProjectionView);druid.actions.push(...druidActions(motherProjectionView));druid.cases=druidCases(motherProjectionView);druid.insideCase=druidInside(natureWalkerInheritedView(s));druid.environment=DRUID_ENVIRONMENT;druid.practice=druidPractice(motherProjectionView);if(s.progression.pathwayId==='mother'&&(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))druid.abilities.unshift(...biologist.abilities);
  const bizarroSorcerer=projectBizarroSorcerer(divinerProjectionView);if(s.progression.pathwayId==='diviner'&&(s.progression.sequence===4||s.progression.sequence===3))bizarroSorcerer.abilities.unshift(...marionettist.abilities);
  const ironBloodKnight=projectIronBloodKnight(hunterProjectionView);if(s.progression.pathwayId==='hunter'&&(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))))ironBloodKnight.abilities.unshift(...reaper.abilities);
  const manipulator=projectManipulator(audienceProjectionView);if(s.progression.pathwayId==='audience'&&(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))))manipulator.abilities.unshift(...dreamwalker.abilities);
  const alchemist=projectAlchemist(paragonProjectionView);if(paragonProjectionView.progression.pathwayId==='paragon'&&(paragonProjectionView.progression.sequence===4||(paragonProjectionView.progression.sequence===3||(paragonProjectionView.progression.sequence===2||paragonProjectionView.progression.sequence===1))))alchemist.abilities.unshift(...astronomer.abilities);
  const witchKing=projectWitchKing(moonS1ProjectionView);if(moonS1ProjectionView.progression.pathwayId==='moon'&&(moonS1ProjectionView.progression.sequence===4||(moonS1ProjectionView.progression.sequence===3||(moonS1ProjectionView.progression.sequence===2||moonS1ProjectionView.progression.sequence===1))))witchKing.abilities.unshift(...crimsonScholar.abilities);
  const nightwatcher=projectNightwatcher(darknessS1ProjectionView);if(darknessS1ProjectionView.progression.pathwayId==='darkness'&&(darknessS1ProjectionView.progression.sequence===4||(darknessS1ProjectionView.progression.sequence===3||(darknessS1ProjectionView.progression.sequence===2||darknessS1ProjectionView.progression.sequence===1))))nightwatcher.abilities.unshift(...spiritWarlock.abilities);
  const prophet=projectProphet(whiteTowerS1ProjectionView);if(whiteTowerS1ProjectionView.progression.pathwayId==='white-tower'&&(whiteTowerS1ProjectionView.progression.sequence===4||(whiteTowerS1ProjectionView.progression.sequence===3||(whiteTowerS1ProjectionView.progression.sequence===2||whiteTowerS1ProjectionView.progression.sequence===1))))prophet.abilities.unshift(...mysticismMagister.abilities);
  const cataclysmPriest=projectCataclysmPriest(tyrantS1ProjectionView);if(tyrantS1ProjectionView.progression.pathwayId==='tyrant'&&(tyrantS1ProjectionView.progression.sequence===4||(tyrantS1ProjectionView.progression.sequence===3||(tyrantS1ProjectionView.progression.sequence===2||tyrantS1ProjectionView.progression.sequence===1))))cataclysmPriest.abilities.unshift(...oceanSinger.abilities);
  const unshadowed=projectUnshadowed(sunS1ProjectionView);if(sunS1ProjectionView.progression.pathwayId==='sun'&&(sunS1ProjectionView.progression.sequence===4||(sunS1ProjectionView.progression.sequence===3||(sunS1ProjectionView.progression.sequence===2||sunS1ProjectionView.progression.sequence===1))))unshadowed.abilities.unshift(...priestOfLight.abilities);
  const undying=projectUndying(deathS1ProjectionView);if(deathS1ProjectionView.progression.pathwayId==='death'&&(deathS1ProjectionView.progression.sequence===4||(deathS1ProjectionView.progression.sequence===3||(deathS1ProjectionView.progression.sequence===2||deathS1ProjectionView.progression.sequence===1))))undying.abilities.unshift(...gatekeeper.abilities);
  const secretsSorcerer=projectSecretsSorcerer(doorProjectionView);if(doorProjectionView.progression.pathwayId==='door'&&(doorProjectionView.progression.sequence===4||(doorProjectionView.progression.sequence===3||doorProjectionView.progression.sequence===2)))secretsSorcerer.abilities.unshift(...traveler.abilities);
  const parasite=projectParasite(errorProjectionView);if(errorProjectionView.progression.pathwayId==='error'&&(errorProjectionView.progression.sequence===4||(errorProjectionView.progression.sequence===3||errorProjectionView.progression.sequence===2)))parasite.abilities.unshift(...dreamStealer.abilities);
  const demonHunter=projectDemonHunter(s);if(s.progression.pathwayId==='warrior'&&(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))demonHunter.abilities.unshift(...guardian.abilities);
  const despair=projectDespair(s);if(s.progression.pathwayId==='demoness'&&(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))despair.abilities.unshift(...pain.abilities);
  const mystic=projectMystic(s);if(s.progression.pathwayId==='hermit'&&(s.progression.sequence===4||s.progression.sequence===3))mystic.abilities.unshift(...starMystic.abilities);
  const blackKnight=projectBlackKnight(s);if(s.progression.pathwayId==='hanged-man'&&(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))blackKnight.abilities.unshift(...shepherd.abilities);
  const devil=projectDevil(s);if(s.progression.pathwayId==='abyss'&&(s.progression.sequence===4||s.progression.sequence===3))devil.abilities.unshift(...desireApostle.abilities);
  const puppet=projectPuppet(chainedProjectionView);if(s.progression.pathwayId==='chained'&&(s.progression.sequence===4||s.progression.sequence===3))puppet.abilities.unshift(...wraith.abilities);
  const misfortuneMage=projectMisfortuneMage(wheelProjectionView);if(s.progression.pathwayId==='wheel'&&(s.progression.sequence===4||s.progression.sequence===3))misfortuneMage.abilities.unshift(...winner.abilities);
  const fallenEarl=projectFallenEarl(blackEmperorProjectionView);if(s.progression.pathwayId==='black-emperor'&&(s.progression.sequence===4||s.progression.sequence===3))fallenEarl.abilities.unshift(...mentorDisorder.abilities);
  const imperativeMage=projectImperativeMage(justiciarProjectionView);if(s.progression.pathwayId==='justiciar'&&(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))imperativeMage.abilities.unshift(...punishmentKnight.abilities);
  const ancientAlchemist=projectAncientAlchemist(motherProjectionView);if(s.progression.pathwayId==='mother'&&(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))ancientAlchemist.abilities.unshift(...druid.abilities);
  const paleEmperor=projectPaleEmperor(deathS1ProjectionView);
  const pureWhiteAngel=projectPureWhiteAngel(sunS1ProjectionView);
  const thunderGod=projectThunderGod(tyrantS1ProjectionView);
  const natureWalker=projectNatureWalker(s);
  const handOfOrder=projectHandOfOrder(s);
  const princeOfAbolition=projectPrinceOfAbolition(s);
  const mercurySnake=projectMercurySnake(s);
  const abomination=projectAbomination(s);
  const uncleanMonarch=projectUncleanMonarch(s);
  const darkAngel=projectDarkAngel(s);
  const knowledgeEmperor=projectKnowledgeEmperor(s);
  const apocalypseDemoness=projectApocalypseDemoness(s);
  const divineHand=projectDivineHand(s);
  const timeWorm=projectTimeWorm(errorS1ProjectionView);
  const starKey=projectStarKey(doorS1ProjectionView);
  const allKnowingEye=projectAllKnowingEye(whiteTowerS1ProjectionView);
  const misfortuneKnight=projectMisfortuneKnight(darknessS1ProjectionView);
  const beautyGoddess=projectBeautyGoddess(moonS1ProjectionView);
  const civilizationEnlightener=projectCivilizationEnlightener(paragonS1ProjectionView);
  const writer=projectWriter(audienceProjectionView);
  const conqueror=projectConqueror(hunterProjectionView);
  const attendantMysteries=projectAttendantMysteries(divinerProjectionView);
  const barrenMatriarch=projectBarrenMatriarch(motherProjectionView);
  const balancer=projectBalancer(justiciarProjectionView);
  const entropyDuke=projectEntropyDuke(blackEmperorProjectionView);
  const fateProphet=projectFateProphet(wheelProjectionView);
  const ancientEvil=projectAncientEvil(chainedProjectionView);
  const bloodDuke=projectBloodDuke(s);
  const elder=projectElder(s);
  const sage=projectSage(s);
  const calamityDemoness=projectCalamityDemoness(s);
  const glory=projectGlory(s);
  const fateTrojan=projectFateTrojan(errorProjectionView);
  const planeswalker=projectPlaneswalker(doorProjectionView);
  const deathConsul=projectDeathConsul(deathS1ProjectionView);
  const lightSeeker=projectLightSeeker(sunS1ProjectionView);
  const catastrophe=projectCatastrophe(tyrantS1ProjectionView);
  const wisdomAngel=projectWisdomAngel(whiteTowerS1ProjectionView);
  const concealmentServant=projectConcealmentServant(darknessS1ProjectionView);
  const lifeGiver=projectLifeGiver(moonS1ProjectionView);
  const knowledgeMentor=projectKnowledgeMentor(paragonProjectionView);
  const discerner=projectDiscerner(audienceProjectionView);
  const weatherWarlock=projectWeatherWarlock(hunterProjectionView);
  const miracleWorker=projectMiracleWorker(divinerProjectionView);
  const coffinBearer=projectCoffinBearer(motherProjectionView);if(s.progression.pathwayId==='mother'&&(s.progression.sequence===3||s.progression.sequence===2))coffinBearer.abilities.unshift(...ancientAlchemist.abilities);
  const chaosHunter=projectChaosHunter(justiciarProjectionView);if(s.progression.pathwayId==='justiciar'&&(s.progression.sequence===3||s.progression.sequence===2))chaosHunter.abilities.unshift(...imperativeMage.abilities);
  const frenzyMage=projectFrenzyMage(blackEmperorProjectionView);if(s.progression.pathwayId==='black-emperor'&&s.progression.sequence===3)frenzyMage.abilities.unshift(...fallenEarl.abilities);
  const chaosWalker=projectChaosWalker(wheelProjectionView);if(s.progression.pathwayId==='wheel'&&s.progression.sequence===3)chaosWalker.abilities.unshift(...misfortuneMage.abilities);
  const silentDisciple=projectSilentDisciple(chainedProjectionView);if(s.progression.pathwayId==='chained'&&s.progression.sequence===3)silentDisciple.abilities.unshift(...puppet.abilities);
  const blatherer=projectBlatherer(s);if(s.progression.pathwayId==='abyss'&&s.progression.sequence===3)blatherer.abilities.unshift(...devil.abilities);
  const threeHeadedTemplar=projectThreeHeadedTemplar(s);if(s.progression.pathwayId==='hanged-man'&&(s.progression.sequence===3||s.progression.sequence===2))threeHeadedTemplar.abilities.unshift(...blackKnight.abilities);
  const prophecyMaster=projectProphecyMaster(s);if(s.progression.pathwayId==='hermit'&&s.progression.sequence===3)prophecyMaster.abilities.unshift(...mystic.abilities);
  const unagingDemoness=projectUnagingDemoness(s);if(s.progression.pathwayId==='demoness'&&(s.progression.sequence===3||s.progression.sequence===2))unagingDemoness.abilities.unshift(...despair.abilities);
  const silverKnight=projectSilverKnight(s);if(s.progression.pathwayId==='warrior'&&(s.progression.sequence===3||s.progression.sequence===2))silverKnight.abilities.unshift(...demonHunter.abilities);
  const deceitMentor=projectDeceitMentor(errorProjectionView);if(errorProjectionView.progression.pathwayId==='error'&&(errorProjectionView.progression.sequence===3||errorProjectionView.progression.sequence===2))deceitMentor.abilities.unshift(...parasite.abilities);
  const wanderer=projectWanderer(doorProjectionView);if(doorProjectionView.progression.pathwayId==='door'&&(doorProjectionView.progression.sequence===3||doorProjectionView.progression.sequence===2))wanderer.abilities.unshift(...secretsSorcerer.abilities);
  const ferryman=projectFerryman(deathS1ProjectionView);if(deathS1ProjectionView.progression.pathwayId==='death'&&(deathS1ProjectionView.progression.sequence===3||(deathS1ProjectionView.progression.sequence===2||deathS1ProjectionView.progression.sequence===1)))ferryman.abilities.unshift(...undying.abilities);
  const justiceMentor=projectJusticeMentor(sunS1ProjectionView);if(sunS1ProjectionView.progression.pathwayId==='sun'&&(sunS1ProjectionView.progression.sequence===3||(sunS1ProjectionView.progression.sequence===2||sunS1ProjectionView.progression.sequence===1)))justiceMentor.abilities.unshift(...unshadowed.abilities);
  const seaKing=projectSeaKing(tyrantS1ProjectionView);if(tyrantS1ProjectionView.progression.pathwayId==='tyrant'&&(tyrantS1ProjectionView.progression.sequence===3||(tyrantS1ProjectionView.progression.sequence===2||tyrantS1ProjectionView.progression.sequence===1)))seaKing.abilities.unshift(...cataclysmPriest.abilities);
  const insightScholar=projectInsightScholar(whiteTowerS1ProjectionView);if(whiteTowerS1ProjectionView.progression.pathwayId==='white-tower'&&(whiteTowerS1ProjectionView.progression.sequence===3||(whiteTowerS1ProjectionView.progression.sequence===2||whiteTowerS1ProjectionView.progression.sequence===1)))insightScholar.abilities.unshift(...prophet.abilities);
  const fearBishop=projectFearBishop(darknessS1ProjectionView);if(darknessS1ProjectionView.progression.pathwayId==='darkness'&&(darknessS1ProjectionView.progression.sequence===3||(darknessS1ProjectionView.progression.sequence===2||darknessS1ProjectionView.progression.sequence===1)))fearBishop.abilities.unshift(...nightwatcher.abilities);
  const summoningMaster=projectSummoningMaster(moonS1ProjectionView);if(moonS1ProjectionView.progression.pathwayId==='moon'&&(moonS1ProjectionView.progression.sequence===3||(moonS1ProjectionView.progression.sequence===2||moonS1ProjectionView.progression.sequence===1)))summoningMaster.abilities.unshift(...witchKing.abilities);
  const arcaneScholar=projectArcaneScholar(paragonProjectionView);if(paragonProjectionView.progression.pathwayId==='paragon'&&(paragonProjectionView.progression.sequence===3||(paragonProjectionView.progression.sequence===2||paragonProjectionView.progression.sequence===1)))arcaneScholar.abilities.unshift(...alchemist.abilities);
  const dreamWeaver=projectDreamWeaver(audienceProjectionView);if(s.progression.pathwayId==='audience'&&(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))dreamWeaver.abilities.unshift(...manipulator.abilities);
  const warBishop=projectWarBishop(hunterProjectionView);if(s.progression.pathwayId==='hunter'&&(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))warBishop.abilities.unshift(...ironBloodKnight.abilities);
  const ancientScholar=projectAncientScholar(divinerProjectionView);if(s.progression.pathwayId==='diviner'&&s.progression.sequence===3)ancientScholar.abilities.unshift(...bizarroSorcerer.abilities);
  const longChapter=projectLongChapter(hasCurrentDeathHistory?deathS1ProjectionView:divinerProjectionView);
  if(s.progression.pathwayId==='diviner'&&s.progression.sequence===2)miracleWorker.abilities.unshift(...ancientScholar.abilities);
  if(s.progression.pathwayId==='hunter'&&(s.progression.sequence===2||s.progression.sequence===1))weatherWarlock.abilities.unshift(...warBishop.abilities);
  if(s.progression.pathwayId==='audience'&&(s.progression.sequence===2||s.progression.sequence===1))discerner.abilities.unshift(...dreamWeaver.abilities);
  if(s.progression.pathwayId==='error'&&s.progression.sequence===2)fateTrojan.abilities.unshift(...deceitMentor.abilities);
  if(s.progression.pathwayId==='door'&&s.progression.sequence===2)planeswalker.abilities.unshift(...wanderer.abilities);
  if(deathS1ProjectionView.progression.pathwayId==='death'&&(deathS1ProjectionView.progression.sequence===2||deathS1ProjectionView.progression.sequence===1))deathConsul.abilities.unshift(...ferryman.abilities);
  if(s.progression.pathwayId==='sun'&&(s.progression.sequence===2||s.progression.sequence===1))lightSeeker.abilities.unshift(...justiceMentor.abilities);
  if(s.progression.pathwayId==='tyrant'&&(s.progression.sequence===2||s.progression.sequence===1))catastrophe.abilities.unshift(...seaKing.abilities);
  if(whiteTowerS1ProjectionView.progression.pathwayId==='white-tower'&&(whiteTowerS1ProjectionView.progression.sequence===2||whiteTowerS1ProjectionView.progression.sequence===1))wisdomAngel.abilities.unshift(...insightScholar.abilities);
  if(darknessS1ProjectionView.progression.pathwayId==='darkness'&&(darknessS1ProjectionView.progression.sequence===2||darknessS1ProjectionView.progression.sequence===1))concealmentServant.abilities.unshift(...fearBishop.abilities);
  if(s.progression.pathwayId==='moon'&&(s.progression.sequence===2||s.progression.sequence===1))lifeGiver.abilities.unshift(...summoningMaster.abilities);
  if(s.progression.pathwayId==='paragon'&&(s.progression.sequence===2||s.progression.sequence===1))knowledgeMentor.abilities.unshift(...arcaneScholar.abilities);
  if(chainedProjectionView!==s){
    // Only these eight completed predecessor projections are historical views.
    // Their saved facts remain readable; every old operation stays closed.
    const closeHistoricalActions=(value:unknown):void=>{
      if(!value||typeof value!=='object')return;
      if(Array.isArray(value)){for(const entry of value)closeHistoricalActions(entry);return;}
      const object=value as Record<string,unknown>;
      if(Array.isArray(object.actions))for(const action of object.actions){
        if(action&&typeof action==='object')Object.assign(action,{enabled:false,reason:'原阶段履历已交接，请返回神孽当前现场。',preferredAction:false});
      }
      if('preferredActionId' in object)object.preferredActionId=null;
      for(const child of Object.values(object))closeHistoricalActions(child);
    };
    for(const historical of [prisoner,madman,werewolf,zombie,wraith,puppet,silentDisciple,ancientEvil])closeHistoricalActions(historical);
  }
  if(wheelProjectionView!==s){
    // Frozen original records remain readable; all predecessor operations close at guidance.
    const closeHistoricalActions=(value:unknown):void=>{
      if(!value||typeof value!=='object')return;
      if(Array.isArray(value)){for(const entry of value)closeHistoricalActions(entry);return;}
      const object=value as Record<string,unknown>;
      if(Array.isArray(object.actions))for(const action of object.actions){
        if(action&&typeof action==='object')Object.assign(action,{enabled:false,reason:'原阶段履历已交接，请返回水银之蛇当前现场。',preferredAction:false});
      }
      if('preferredActionId' in object)object.preferredActionId=null;
      for(const child of Object.values(object))closeHistoricalActions(child);
    };
    for(const historical of [monster,machine,lucky,calamityPriest,winner,misfortuneMage,chaosWalker,fateProphet])closeHistoricalActions(historical);
  }
  if(blackEmperorProjectionView!==s){
    briber.gifts.summary='此处保留交接时的原木筹记录，当前可用数量与去向请查看弑序亲王库存。旧记录不再用于消费。';
    // Frozen original records remain readable; all predecessor operations close at guidance.
    const closeHistoricalActions=(value:unknown):void=>{
      if(!value||typeof value!=='object')return;
      if(Array.isArray(value)){for(const entry of value)closeHistoricalActions(entry);return;}
      const object=value as Record<string,unknown>;
      if(Array.isArray(object.actions))for(const action of object.actions){
        if(action&&typeof action==='object')Object.assign(action,{enabled:false,reason:'原阶段履历已交接，请返回弑序亲王当前现场。',preferredAction:false});
      }
      if('preferredActionId' in object)object.preferredActionId=null;
      for(const child of Object.values(object))closeHistoricalActions(child);
    };
    for(const historical of [lawyer,barbarian,briber,corruptionBaron,mentorDisorder,fallenEarl,frenzyMage,entropyDuke])closeHistoricalActions(historical);
  }
  if(justiciarProjectionView!==s){
    // Frozen original records remain readable; all predecessor operations close at guidance.
    const closeHistoricalActions=(value:unknown):void=>{
      if(!value||typeof value!=='object')return;
      if(Array.isArray(value)){for(const entry of value)closeHistoricalActions(entry);return;}
      const object=value as Record<string,unknown>;
      if(Array.isArray(object.actions))for(const action of object.actions){
        if(action&&typeof action==='object')Object.assign(action,{enabled:false,reason:'原阶段履历已交接，请返回秩序之手当前现场。',preferredAction:false});
      }
      if('preferredActionId' in object)object.preferredActionId=null;
      for(const child of Object.values(object))closeHistoricalActions(child);
    };
    for(const historical of [arbiter,sheriff,interrogator,judge,punishmentKnight,imperativeMage,chaosHunter,balancer])closeHistoricalActions(historical);
  }
  // Reuse this exact immutable input's source check within one public projection.
  if(hasCurrentFoolHistory){
    const closeHistoricalActions=(value:unknown):void=>{
      if(!value||typeof value!=='object')return;
      if(Array.isArray(value)){for(const entry of value)closeHistoricalActions(entry);return;}
      const object=value as Record<string,unknown>;
      if(Array.isArray(object.actions))for(const action of object.actions){
        if(action&&typeof action==='object')Object.assign(action,{enabled:false,reason:'原有经历已封存，请在当前筹备处与现场继续行动。',preferredAction:false});
      }
      if('preferredActionId'in object)object.preferredActionId=null;
      for(const child of Object.values(object))closeHistoricalActions(child);
    };
    for(const history of [seer,clown,magician,faceless,marionettist,bizarroSorcerer,ancientScholar,miracleWorker,attendantMysteries,longChapter])closeHistoricalActions(history);
  }
  if(hasCurrentRedPriestHistory){
    const closeHistory=(value:unknown):void=>{
      if(!value||typeof value!=='object')return;
      if(Array.isArray(value)){for(const child of value)closeHistory(child);return;}
      const object=value as Record<string,unknown>;
      if(Array.isArray(object.actions))for(const action of object.actions)if(action&&typeof action==='object')Object.assign(action,{enabled:false,reason:'原有经历已封存，请在当前战役与筹备处继续行动。',preferredAction:false});
      if('preferredActionId'in object)object.preferredActionId=null;
      for(const child of Object.values(object))closeHistory(child);
    };
    for(const history of [hunter,provoker,pyromaniac,conspirator,reaper,ironBloodKnight,warBishop,weatherWarlock,conqueror])closeHistory(history);
  }
  if(hasCurrentVisionaryHistory){
    const closeHistory=(value:unknown):void=>{
      if(!value||typeof value!=='object')return;
      if(Array.isArray(value)){for(const child of value)closeHistory(child);return;}
      const object=value as Record<string,unknown>;
      if(Array.isArray(object.actions))for(const action of object.actions)if(action&&typeof action==='object')Object.assign(action,{enabled:false,reason:'原有经历已封存，请在当前时代筹备与现场继续行动。',preferredAction:false});
      if('preferredActionId'in object)object.preferredActionId=null;
      for(const child of Object.values(object))closeHistory(child);
    };
    for(const history of [audience,mindreader,psychologist,hypnotist,dreamwalker,manipulator,dreamWeaver,discerner,writer])closeHistory(history);
  }
  if(hasCurrentPerfecterHistory){
    const closeHistory=(value:unknown):void=>{
      if(!value||typeof value!=='object')return;
      if(Array.isArray(value)){for(const child of value)closeHistory(child);return;}
      const object=value as Record<string,unknown>;
      if(Array.isArray(object.actions))for(const action of object.actions)if(action&&typeof action==='object')Object.assign(action,{enabled:false,reason:'原有经历已封存，请在当前工坊与大陆事务中继续行动。',preferredAction:false});
      if('preferredActionId'in object)object.preferredActionId=null;
      for(const child of Object.values(object))closeHistory(child);
    };
    for(const history of [savant,archaeologist,appraiser,artisan,astronomer,alchemist,arcaneScholar,knowledgeMentor,civilizationEnlightener])closeHistory(history);
  }
  if(hasCurrentMoonHistory){
    const closeHistory=(value:unknown):void=>{
      if(!value||typeof value!=='object')return;
      if(Array.isArray(value)){for(const child of value)closeHistory(child);return;}
      const object=value as Record<string,unknown>;
      if(Array.isArray(object.actions))for(const action of object.actions)if(action&&typeof action==='object')Object.assign(action,{enabled:false,reason:'原有经历已封存，请在当前夜航与筹备处中继续行动。',preferredAction:false});
      if('preferredActionId'in object)object.preferredActionId=null;
      for(const child of Object.values(object))closeHistory(child);
    };
    for(const history of [apothecary,tamer,vampire,potionProfessor,crimsonScholar,witchKing,summoningMaster,lifeGiver,beautyGoddess])closeHistory(history);
  }
  if(hasCurrentDarknessHistory){
    const closeHistory=(value:unknown):void=>{
      if(!value||typeof value!=='object')return;
      if(Array.isArray(value)){for(const child of value)closeHistory(child);return;}
      const object=value as Record<string,unknown>;
      if(Array.isArray(object.actions))for(const action of object.actions)if(action&&typeof action==='object')Object.assign(action,{enabled:false,reason:'原有经历已封存，请在当前长夜撤离与筹备处中继续行动。',preferredAction:false});
      if('preferredActionId'in object)object.preferredActionId=null;
      for(const child of Object.values(object))closeHistory(child);
    };
    for(const history of [sleepless,midnight,nightmare,soother,spiritWarlock,nightwatcher,fearBishop,concealmentServant,misfortuneKnight])closeHistory(history);
  }
  if(hasCurrentWhiteTowerHistory){
    const closeHistory=(value:unknown):void=>{
      if(!value||typeof value!=='object')return;
      if(Array.isArray(value)){for(const child of value)closeHistory(child);return;}
      const object=value as Record<string,unknown>;
      if(Array.isArray(object.actions))for(const action of object.actions)if(action&&typeof action==='object')Object.assign(action,{enabled:false,reason:'原有经历已封存，请在当前城市通路与筹备处中继续行动。',preferredAction:false});
      if('preferredActionId'in object)object.preferredActionId=null;
      for(const child of Object.values(object))closeHistory(child);
    };
    for(const history of [reader,reasoner,detective,polymath,mysticismMagister,prophet,insightScholar,wisdomAngel,allKnowingEye])closeHistory(history);
  }
  if(hasCurrentTyrantHistory){
    const closeHistory=(value:unknown):void=>{
      if(!value||typeof value!=='object')return;
      if(Array.isArray(value)){for(const child of value)closeHistory(child);return;}
      const object=value as Record<string,unknown>;
      if(Array.isArray(object.actions))for(const action of object.actions)if(action&&typeof action==='object')Object.assign(action,{enabled:false,reason:'原有经历已封存，请在当前海岸与筹备处中继续行动。',preferredAction:false});
      if('preferredActionId'in object)object.preferredActionId=null;
      for(const child of Object.values(object))closeHistory(child);
    };
    for(const history of [sailor,rager,navigator,windBlessed,oceanSinger,cataclysmPriest,seaKing,catastrophe,thunderGod])closeHistory(history);
  }
  if(hasCurrentSunHistory){
    const closeHistory=(value:unknown):void=>{
      if(!value||typeof value!=='object')return;
      if(Array.isArray(value)){for(const child of value)closeHistory(child);return;}
      const object=value as Record<string,unknown>;
      if(Array.isArray(object.actions))for(const action of object.actions)if(action&&typeof action==='object')Object.assign(action,{enabled:false,reason:'原有经历已封存，请在当前街区与筹备处中继续行动。',preferredAction:false});
      if('preferredActionId'in object)object.preferredActionId=null;
      for(const child of Object.values(object))closeHistory(child);
    };
    for(const history of [bard,lightprayer,sunpriest,notary,priestOfLight,unshadowed,justiceMentor,lightSeeker,pureWhiteAngel])closeHistory(history);
  }
  if(hasCurrentDeathHistory){
    const closeHistory=(value:unknown):void=>{
      if(!value||typeof value!=='object')return;
      if(Array.isArray(value)){for(const child of value)closeHistory(child);return;}
      const object=value as Record<string,unknown>;
      if(Array.isArray(object.actions))for(const action of object.actions)if(action&&typeof action==='object')Object.assign(action,{enabled:false,reason:'原有经历已封存，请在当前接待处与死神筹备现场中继续行动。',preferredAction:false});
      if('preferredActionId'in object)object.preferredActionId=null;
      for(const child of Object.values(object))closeHistory(child);
    };
    for(const history of [corpsecollector,gravedigger,spiritmedium,spiritGuide,gatekeeper,undying,ferryman,deathConsul,paleEmperor,longChapter])closeHistory(history);
  }
  if(hasCurrentDoorHistory){
    const closeHistory=(value:unknown):void=>{
      if(!value||typeof value!=='object')return;
      if(Array.isArray(value)){for(const child of value)closeHistory(child);return;}
      const object=value as Record<string,unknown>;
      if(Array.isArray(object.actions))for(const action of object.actions)if(action&&typeof action==='object')Object.assign(action,{enabled:false,reason:'原有经历已封存，请在当前门途径筹备处与居民服务现场中继续行动。',preferredAction:false});
      if('preferredActionId'in object)object.preferredActionId=null;
      for(const child of Object.values(object))closeHistory(child);
    };
    for(const history of [apprentice,trickmaster,astrologer,recorder,traveler,secretsSorcerer,wanderer,planeswalker,starKey])closeHistory(history);
  }
  if(hasCurrentErrorAscentHistory){
    const closeHistory=(value:unknown):void=>{
      if(!value||typeof value!=='object')return;
      if(Array.isArray(value)){for(const child of value)closeHistory(child);return;}
      const object=value as Record<string,unknown>;
      if(Array.isArray(object.actions))for(const action of object.actions)if(action&&typeof action==='object')Object.assign(action,{enabled:false,reason:'原有经历已封存，请在当前错误晋升筹备与仪式现场中继续行动。',preferredAction:false});
      if('preferredActionId'in object)object.preferredActionId=null;
      for(const child of Object.values(object))closeHistory(child);
    };
    for(const history of [marauder,swindler,cryptologist,fireThief,dreamStealer,parasite,deceitMentor,fateTrojan,timeWorm])closeHistory(history);
  }
  const result: Omit<SliceProjection, 'recovery'> = {errorAscent,door,death,sun,tyrant,whiteTower,darkness,moon,perfecter,visionary,redPriest,fool,natureWalker,handOfOrder,princeOfAbolition,mercurySnake,abomination,uncleanMonarch,darkAngel,knowledgeEmperor,apocalypseDemoness,divineHand,timeWorm,starKey,paleEmperor,pureWhiteAngel,thunderGod,allKnowingEye,misfortuneKnight,beautyGoddess,civilizationEnlightener,writer,conqueror,attendantMysteries,barrenMatriarch,balancer,entropyDuke,fateProphet,ancientEvil,bloodDuke,elder,sage,calamityDemoness,glory,fateTrojan,planeswalker,deathConsul,lightSeeker,catastrophe,wisdomAngel,concealmentServant,lifeGiver,knowledgeMentor,discerner,weatherWarlock,miracleWorker,coffinBearer,chaosHunter,frenzyMage,chaosWalker,silentDisciple,blatherer,threeHeadedTemplar,prophecyMaster,unagingDemoness,silverKnight,deceitMentor,wanderer,ferryman,justiceMentor,seaKing,insightScholar,fearBishop,summoningMaster,arcaneScholar,dreamWeaver,warBishop,ancientScholar,longChapter,ancientAlchemist,imperativeMage,fallenEarl,misfortuneMage,puppet,devil,blackKnight,mystic,despair,demonHunter,parasite,secretsSorcerer,undying,unshadowed,cataclysmPriest,prophet,nightwatcher,witchKing,alchemist,manipulator,ironBloodKnight,bizarroSorcerer,druid,punishmentKnight,mentorDisorder,winner,wraith,desireApostle,shepherd,starMystic,pain,guardian,dreamStealer,traveler,gatekeeper,priestOfLight,oceanSinger,mysticismMagister,spiritWarlock,crimsonScholar,astronomer,dreamwalker,reaper,marionettist,biologist,judge,corruptionBaron,calamityPriest,zombie,demon,roseBishop,scrollProfessor,pleasure,dawnPaladin,fireThief,recorder,spiritGuide,notary,windBlessed,polymath,soother,potionProfessor,artisan,hypnotist,conspirator,faceless,harvestpriest,physician,cultivator,interrogator,sheriff,arbiter,briber,barbarian,lawyer,lucky,machine,monster,werewolf,madman,prisoner,serialKiller,unwinged,criminal,shadowAscetic,listener,secretSupplicant,wizard,combatScholar,pryer,witch,instigator,assassin,weaponmaster,gladiator,warrior,cryptologist,swindler,marauder,astrologer,trickmaster,apprentice,spiritmedium,gravedigger,corpsecollector,sunpriest,lightprayer,bard,navigator,rager,sailor,detective,reasoner,reader,nightmare,midnight,sleepless,vampire,appraiser,psychologist,pyromaniac,magician,tamer,apothecary,archaeologist,savant,town,mindreader,audience,provoker,hunter,clown,caseArchive:clone(s.caseArchive),progression:clone(s.progression),seer,runId:s.runId,revision:s.revision,status:s.status,character:clone(s.character),week:s.week,date:{...s.date},actionsRemaining:s.actionsRemaining,weeklyBudget:s.weeklyBudget,cash:s.cash,lifeTier:s.lifeTier,nextLifeTier:s.nextLifeTier,weeklyWage:s.character.weeklyWage,wagePaid:s.wagePaidWeek===s.week,health:s.health,mind:s.mind,spirituality:s.spirituality,maxHealth:100,maxMind:100,maxSpirituality:s.progression.pathwayId==='error'&&s.progression.sequence===0&&hasCurrentErrorAscentHistory?150:s.progression.pathwayId==='door'&&s.progression.sequence===0&&hasCurrentDoorHistory?150:s.progression.pathwayId==='death'&&s.progression.sequence===0&&hasCurrentDeathHistory?150:s.progression.pathwayId==='sun'&&s.progression.sequence===0&&hasCurrentSunHistory?150:s.progression.pathwayId==='tyrant'&&s.progression.sequence===0&&hasCurrentTyrantHistory?150:s.progression.pathwayId==='white-tower'&&s.progression.sequence===0&&hasCurrentWhiteTowerHistory?150:s.progression.pathwayId==='darkness'&&s.progression.sequence===0&&hasCurrentDarknessHistory?150:s.progression.pathwayId==='moon'&&s.progression.sequence===0&&hasCurrentMoonHistory?150:s.progression.pathwayId==='paragon'&&s.progression.sequence===0&&hasCurrentPerfecterHistory?150:s.progression.pathwayId==='diviner'&&s.progression.sequence===0&&hasCurrentFoolHistory?120:(s.progression.pathwayId==='diviner'||s.progression.pathwayId==='hunter'||s.progression.pathwayId==='audience'||s.progression.pathwayId==='paragon'||s.progression.pathwayId==='moon'||s.progression.pathwayId==='darkness'||s.progression.pathwayId==='white-tower'||s.progression.pathwayId==='tyrant'||s.progression.pathwayId==='sun'||s.progression.pathwayId==='death'||s.progression.pathwayId==='door'||s.progression.pathwayId==='error'||s.progression.pathwayId==='warrior'||s.progression.pathwayId==='demoness'||s.progression.pathwayId==='hermit'||s.progression.pathwayId==='hanged-man'||s.progression.pathwayId==='abyss'||s.progression.pathwayId==='chained'||s.progression.pathwayId==='wheel'||s.progression.pathwayId==='black-emperor'||s.progression.pathwayId==='justiciar'||s.progression.pathwayId==='mother')&&s.progression.sequence===1?120:(s.progression.pathwayId==='diviner'||s.progression.pathwayId==='hunter'||s.progression.pathwayId==='audience'||s.progression.pathwayId==='paragon'||s.progression.pathwayId==='moon'||s.progression.pathwayId==='darkness'||s.progression.pathwayId==='white-tower'||s.progression.pathwayId==='tyrant'||s.progression.pathwayId==='sun'||s.progression.pathwayId==='death'||s.progression.pathwayId==='door'||s.progression.pathwayId==='error'||s.progression.pathwayId==='warrior'||s.progression.pathwayId==='demoness'||s.progression.pathwayId==='hermit'||s.progression.pathwayId==='hanged-man'||s.progression.pathwayId==='abyss'||s.progression.pathwayId==='chained'||s.progression.pathwayId==='wheel'||s.progression.pathwayId==='black-emperor'||s.progression.pathwayId==='justiciar'||s.progression.pathwayId==='mother')&&s.progression.sequence===2?120:(s.progression.pathwayId==='diviner'||s.progression.pathwayId==='hunter'||s.progression.pathwayId==='audience'||s.progression.pathwayId==='paragon'||s.progression.pathwayId==='moon'||s.progression.pathwayId==='darkness'||s.progression.pathwayId==='white-tower'||s.progression.pathwayId==='tyrant'||s.progression.pathwayId==='sun'||s.progression.pathwayId==='death'||s.progression.pathwayId==='door'||s.progression.pathwayId==='error'||s.progression.pathwayId==='warrior'||s.progression.pathwayId==='demoness'||s.progression.pathwayId==='hermit'||s.progression.pathwayId==='hanged-man'||s.progression.pathwayId==='abyss'||s.progression.pathwayId==='chained'||s.progression.pathwayId==='wheel'||s.progression.pathwayId==='black-emperor'||s.progression.pathwayId==='justiciar'||s.progression.pathwayId==='mother')&&s.progression.sequence===3?120:(s.progression.pathwayId==='diviner'||s.progression.pathwayId==='hunter'||s.progression.pathwayId==='audience'||s.progression.pathwayId==='paragon'||s.progression.pathwayId==='moon'||s.progression.pathwayId==='darkness'||s.progression.pathwayId==='white-tower'||s.progression.pathwayId==='tyrant'||s.progression.pathwayId==='sun'||s.progression.pathwayId==='death'||s.progression.pathwayId==='door'||s.progression.pathwayId==='error'||s.progression.pathwayId==='warrior'||s.progression.pathwayId==='demoness'||s.progression.pathwayId==='hermit'||s.progression.pathwayId==='hanged-man'||s.progression.pathwayId==='abyss'||s.progression.pathwayId==='chained'||s.progression.pathwayId==='wheel'||s.progression.pathwayId==='black-emperor'||s.progression.pathwayId==='justiciar'||s.progression.pathwayId==='mother')&&s.progression.sequence===4?120:s.progression.sequence===5?100:s.progression.sequence===6?80:s.progression.sequence===7?60:s.progression.sequence===8?45:s.progression.pathwayId!==null?30:15,pollution:s.seer.pollution,injuries:clone(s.injuries),injuryRisk:s.injuryRisk,debtTotal:debtTotal(s),debts:clone(s.debts),missedWeeks:s.missedWeeks,credit:s.credit,learnTargets:learnTargets(s),investigateTargets:investigationTargets(s),canAct:!hasCurrentErrorAscentHistory&&!hasCurrentDoorHistory&&!hasCurrentDeathHistory&&!hasCurrentSunHistory&&!hasCurrentTyrantHistory&&!hasCurrentDarknessHistory&&!hasCurrentMoonHistory&&!hasCurrentPerfecterHistory&&!hasCurrentRedPriestHistory&&!hasCurrentFoolHistory&&!natureWalker.insideCase&&!handOfOrder.insideCase&&!princeOfAbolition.insideCase&&!mercurySnake.insideCase&&!abomination.insideCase&&!uncleanMonarch.insideCase&&!darkAngel.insideCase&&!knowledgeEmperor.insideCase&&!apocalypseDemoness.insideCase&&!divineHand.insideCase&&!timeWorm.insideCase&&!paleEmperor.insideCase&&!pureWhiteAngel.insideCase&&!thunderGod.insideCase&&!allKnowingEye.insideCase&&!misfortuneKnight.insideCase&&!beautyGoddess.insideCase&&!civilizationEnlightener.insideCase&&!writer.insideCase&&!conqueror.insideCase&&!balancer.insideCase&&!entropyDuke.insideCase&&!fateProphet.insideCase&&!sage.insideCase&&!calamityDemoness.insideCase&&!glory.insideCase&&!fateTrojan.insideCase&&!planeswalker.insideCase&&!deathConsul.insideCase&&!lightSeeker.insideCase&&!catastrophe.insideCase&&!wisdomAngel.insideCase&&!concealmentServant.insideCase&&!lifeGiver.insideCase&&!knowledgeMentor.insideCase&&!discerner.insideCase&&!weatherWarlock.insideCase&&!coffinBearer.insideCase&&!chaosHunter.insideCase&&!frenzyMage.insideCase&&!chaosWalker.insideCase&&!silentDisciple.insideCase&&!blatherer.insideCase&&!threeHeadedTemplar.insideCase&&!prophecyMaster.insideCase&&!unagingDemoness.insideCase&&!silverKnight.insideCase&&!deceitMentor.insideCase&&!wanderer.insideCase&&!ferryman.insideCase&&!justiceMentor.insideCase&&!seaKing.insideCase&&!insightScholar.insideCase&&!fearBishop.insideCase&&!summoningMaster.insideCase&&!arcaneScholar.insideCase&&!dreamWeaver.insideCase&&!warBishop.insideCase&&!ancientScholar.locked&&!ancientScholar.eraClosed&&!longChapter.locked&&!longChapter.eraClosed&&!ancientAlchemist.insideCase&&!imperativeMage.insideCase&&!fallenEarl.insideCase&&!misfortuneMage.insideCase&&!puppet.insideCase&&!devil.insideCase&&!blackKnight.insideCase&&!mystic.insideCase&&!despair.insideCase&&!demonHunter.insideCase&&!parasite.insideCase&&!secretsSorcerer.insideCase&&!undying.insideCase&&!unshadowed.insideCase&&!cataclysmPriest.insideCase&&!prophet.insideCase&&!nightwatcher.insideCase&&!witchKing.insideCase&&!alchemist.insideCase&&!manipulator.insideCase&&!ironBloodKnight.insideCase&&!bizarroSorcerer.insideCase&&!druid.insideCase&&!punishmentKnight.insideCase&&!mentorDisorder.insideCase&&!winner.insideCase&&!wraith.insideCase&&!desireApostle.insideCase&&!shepherd.insideCase&&!starMystic.insideCase&&!pain.insideCase&&!guardian.insideCase&&!dreamStealer.insideCase&&!traveler.insideCase&&!gatekeeper.insideCase&&!priestOfLight.insideCase&&!oceanSinger.insideCase&&!mysticismMagister.insideCase&&!spiritWarlock.insideCase&&!crimsonScholar.insideCase&&!astronomer.insideCase&&!dreamwalker.insideCase&&!reaper.insideCase&&!marionettist.insideCase&&!biologist.insideCase&&!judge.insideCase&&!corruptionBaron.insideCase&&!calamityPriest.insideCase&&!zombie.insideCase&&!demon.insideCase&&!roseBishop.insideCase&&!scrollProfessor.insideCase&&!pleasure.insideCase&&!dawnPaladin.insideCase&&!fireThief.insideCase&&!recorder.insideCase&&!spiritGuide.insideCase&&!notary.insideCase&&!windBlessed.insideCase&&!polymath.insideCase&&!soother.insideCase&&!potionProfessor.insideCase&&!artisan.insideCase&&!hypnotist.insideCase&&!conspirator.insideCase&&!faceless.insideCase&&!harvestpriest.insideCase&&!physician.insideCase&&!cultivator.insideCase&&!interrogator.insideCase&&!sheriff.insideCase&&!arbiter.insideCase&&!briber.insideCase&&!barbarian.insideCase&&!lawyer.insideCase&&!lucky.insideCase&&!machine.insideCase&&!monster.insideCase&&!werewolf.insideCase&&!madman.insideCase&&!prisoner.insideCase&&!serialKiller.insideCase&&!unwinged.insideCase&&!criminal.insideCase&&!shadowAscetic.insideCase&&!listener.insideCase&&!secretSupplicant.insideCase&&!wizard.insideCase&&!combatScholar.insideCase&&!pryer.insideCase&&!instigator.insideCase&&!assassin.insideCase&&!gladiator.insideCase&&s.status==='ACTIVE'&&!s.activeEvent&&!s.combat&&s.actionsRemaining>0&&s.tamer.companionId===null,actionBlockedReason:hasCurrentErrorAscentHistory?'请在当前错误晋升筹备与仪式现场继续行动。':hasCurrentDoorHistory?'请在当前门途径筹备处与居民服务现场继续行动。':hasCurrentDeathHistory?'请在当前接待处与死神筹备现场继续行动。':hasCurrentSunHistory?'请在当前街区与筹备处继续行动。':hasCurrentTyrantHistory?'请在当前海岸、神战现场或筹备处继续行动。':hasCurrentDarknessHistory?'请在当前长夜撤离与筹备处继续行动。':hasCurrentMoonHistory?'请在当前夜航与筹备处继续行动。':hasCurrentPerfecterHistory?'请在当前工坊与大陆事务中继续行动。':hasCurrentRedPriestHistory?'请在当前战役与筹备处继续行动。':hasCurrentFoolHistory?'请在当前筹备处与现场继续行动。':natureWalker.insideCase?'先停止当前联系并普通归还原植、原物，沿原路离场，或取消服药准备。':handOfOrder.insideCase?'先收束当前有限联系、归还原物并沿原路离开，或取消服药准备。':princeOfAbolition.insideCase?'先收束当前有限联系、归还原物并沿原路离开，或取消服药准备。':mercurySnake.insideCase?'先收束当前有限联系、归还原物并沿原路离开，或取消服药准备。':abomination.insideCase?'先收束当前灵性束障与短声窗口，归还原物并沿原路离开。':uncleanMonarch.insideCase?'先收束当前冲动收束与定向扰动窗口，归还原物并沿原路离开。':darkAngel.insideCase?'先收束当前单灵引导与护持窗口，归还原物并沿原路离开。':knowledgeEmperor.insideCase?'先收束当前知识赋力与循力求知窗口，归还原物并沿原路离开。':apocalypseDemoness.insideCase?'先收束当前残留脉冲与镜面窗口，归还原物并沿原路离开。':divineHand.insideCase?'先收束当前载荷与护甲窗口，归还原物并沿原路离开。':timeWorm.insideCase?'先收束尚未执行的查看动作与短时窗口，再沿原路离开。':paleEmperor.insideCase?'先结束残响窗口、归还原器皿并走返。':pureWhiteAngel.insideCase?'先结束当前观察窗口、归还原试片与护片并走返。':thunderGod.insideCase?'先结束当前观察窗口、归还原靶片与护片并走返。':allKnowingEye.insideCase?'先结束当前观察窗口、归还原纸与滑轨并走返。':misfortuneKnight.insideCase?'先结束当前动作窗口、归还原盒与护片并走返。':beautyGoddess.insideCase?'先结束当前月光窗口、归还原灯和月片并走返。':civilizationEnlightener.insideCase?'先停止当前负载、实际归还原工具并走返。':writer.insideCase?'先结束当前安排、实际归还原书并走返。':conqueror.insideCase?'先收束当前原院事务并让同伴实际离场。':balancer.insideCase?'先停止当前辨察或抵御、归还原物并沿门口退出。':entropyDuke.insideCase?'先收束当前施作并归还原物，沿门口退出。':fateProphet.insideCase?'先停止本次预察或调整并归还同一原物。':sage.insideCase?'先收束信息化、处理眼前封存并沿实际路线返回':calamityDemoness.insideCase?'先停止当前施作、处理插片与封存箱并沿实际路线退出镜廊附室':glory.insideCase?'先停止当前护持、交还借物并沿实际路线退出修整室':fateTrojan.insideCase?'先解除当前联系、归还原物并沿实际路线退出登记所':planeswalker.insideCase?'先沿已核返程回到本地并收束当前星途现场':deathConsul.insideCase?'先收束苍白焰与短渡并沿实际路线退出':lightSeeker.insideCase?'先停止光照、归还遮具并沿原路退出':catastrophe.insideCase?'先停止风水、排回原水并沿干路退出':wisdomAngel.insideCase?'先停止应对并沿原路归还原件':knowledgeMentor.insideCase?'先停止工序并沿原路取回原件':discerner.insideCase?'先停止接触并沿原路归还原卡':weatherWarlock.insideCase?'先停止天气并从原出口收束现场':coffinBearer.insideCase?'先收束抬棺人现场。':chaosHunter.insideCase?'先收束混乱猎手现场。':frenzyMage.insideCase?'先收束狂乱法师现场。':chaosWalker.insideCase?'先收束混乱行者现场。':silentDisciple.insideCase?'先收束沉默门徒现场。':blatherer.insideCase?'先收束呓语者现场。':threeHeadedTemplar.insideCase?'先收束三首圣堂现场。':prophecyMaster.insideCase?'先收束预言大师现场。':unagingDemoness.insideCase?'先收束原镜内道路或不老魔女现场。':silverKnight.insideCase?'先收束原猎场、祭坛或银骑士现场。':deceitMentor.insideCase?'先停止有限欺瞒并归还同一原物。':wanderer.insideCase?'先实际返回并收束原锚、护具和原封包。':ferryman.insideCase?'先实际收束摆渡人原现场与原物。':justiceMentor.insideCase?'先实际收束正义导师原现场与原物。':seaKing.insideCase?'先实际收束海王原现场与原物。':insightScholar.insideCase?'先实际收束洞悉者候选G原现场与原物。':fearBishop.insideCase?'先实际收束恐惧主教原现场与原物。':summoningMaster.insideCase?'先实际收束召唤大师原现场与来客。':arcaneScholar.insideCase?'先实际收束奥秘学者原现场与造物。':dreamWeaver.insideCase?'先实际收束织梦人原现场与身份。':warBishop.insideCase?'先实际收束战争主教原队伍与原物。':ancientScholar.eraClosed?'旧时代已结束，请使用本章当前生活与实践。':ancientScholar.locked?'请先完成本章封存或当前原物交接。':longChapter.eraClosed?'旧时代行动已经关闭，请使用新年代接待处。':longChapter.locked?'请先完成当前长期章节与原物交接。':ancientAlchemist.insideCase?'先实际退出当前古代炼金师练习现场':imperativeMage.insideCase?'先实际退出当前律令法师练习现场':fallenEarl.insideCase?'先实际退出当前堕落伯爵练习现场':misfortuneMage.insideCase?'先实际退出当前厄运法师练习现场':puppet.insideCase?'先实际退出当前木偶练习现场':devil.insideCase?'先实际退出当前魔鬼练习现场':blackKnight.insideCase?'先实际退出当前黑骑士练习现场':mystic.insideCase?'先实际退出当前神秘学家练习现场':despair.insideCase?'先实际退出当前绝望魔女练习现场':demonHunter.insideCase?'先实际结束当前猎魔者现场':parasite.insideCase?'先实际结束当前寄生者接触':secretsSorcerer.insideCase?'先实际结束秘法师当前现场':undying.insideCase?'先实际结束当前不死者现场':unshadowed.insideCase?'先实际结束当前无暗者现场':cataclysmPriest.insideCase?'先实际结束当前灾难主祭现场':prophet.insideCase?'先实际结束当前预言家现场':nightwatcher.insideCase?'先实际结束当前守夜人现场':witchKing.insideCase?'先实际结束当前巫王现场':alchemist.insideCase?'先实际结束当前炼金术士现场':manipulator.insideCase?'先实际结束当前心灵接触或集会':ironBloodKnight.insideCase?'先实际收束铁血骑士当前现场':bizarroSorcerer.insideCase?'先实际结束诡法师当前现场':druid.insideCase?'先0行动结束德鲁伊实践并退出原现场':punishmentKnight.insideCase?'先0行动结束惩戒骑士实践并退出原现场':mentorDisorder.insideCase?'先0行动结束混乱导师实践并退出原现场':winner.insideCase?'先0行动结束赢家实践并退出原现场':wraith.insideCase?(wraith.moon.pending?'先实际度过本次怨魂满月极度虚弱':'先0行动结束怨魂实践并退出原现场'):desireApostle.insideCase?'先0行动结束欲望使徒实践并退出原现场':shepherd.insideCase?'先0行动结束牧羊人实践并退出原现场':starMystic.insideCase?'先0行动结束星象师实践并退出原现场':pain.insideCase?'先0行动结束痛苦魔女实践并退出原现场':guardian.insideCase?'先0行动结束守护者实践并退出原现场':dreamStealer.insideCase?'先0行动结束窃梦家实践并退出原现场':traveler.insideCase?'先0行动结束旅行家实践并退出原现场':gatekeeper.insideCase?'先0行动结束看门人实践并退出原现场':priestOfLight.insideCase?'先0行动结束光之祭司实践并退出原现场':oceanSinger.insideCase?'先0行动结束海洋歌者实践并退出原现场':mysticismMagister.insideCase?'先0行动结束秘术导师实践并退出原现场':spiritWarlock.insideCase?'先0行动结束灵巫实践并退出原现场':crimsonScholar.insideCase?'先0行动结束深红学者实践并退出原现场':astronomer.insideCase?'先0行动结束天文学家实践并退出原现场':dreamwalker.insideCase?'先结束梦境、实际返回或结束仪式':reaper.insideCase?'先0行动结束收割者实践并退出原现场':marionettist.insideCase?'先结束仪式、释放初控或退出当前接触':biologist.insideCase?'先0行动结束生物学家实践并退出原现场':judge.insideCase?'先0行动结束法官实践并退出原现场':corruptionBaron.insideCase?'先0行动结束腐化男爵实践并退出原现场':calamityPriest.insideCase?'先0行动结束灾祸教士实践并退出原现场':zombie.insideCase?(zombie.moon.pending?'先实际度过本次活尸月圆剧痛':'先0行动结束活尸实践并退出原现场'):demon.insideCase?'先0行动结束恶魔实践并退出原现场':roseBishop.insideCase?'先0行动结束血肉调节并退出原现场':scrollProfessor.insideCase?'先0行动结束卷轴实践并退出原现场':pleasure.insideCase?'先0行动结束丝线与交流实践并退出原现场':dawnPaladin.insideCase?'先0行动结束晨曦实践并退出原现场':fireThief.insideCase?'先0行动结束暂借实践并退出原现场':recorder.insideCase?'先0行动结束记录实践并退出原现场':spiritGuide.insideCase?'先0行动结束通灵实践并退出原现场':notary.insideCase?'先0行动结束公证实践并归还原工具':windBlessed.insideCase?'先0行动结束控风练习并沿原路返回地面':polymath.insideCase?'先0行动结束样本试演现场':soother.insideCase?'先0行动结束安魂现场':potionProfessor.insideCase?'先0行动结束药剂试验现场':artisan.insideCase?'先0行动结束工房现场':hypnotist.insideCase?'先0行动停止本次影响并退出':conspirator.insideCase?'先0行动结束当前交涉':faceless.insideCase?'先0行动结束当前接触':harvestpriest.insideCase?'先0行动停止练习并退开':physician.insideCase?'先0行动停止练习并退开':cultivator.insideCase?'先0行动放回原记录并结束交谈':interrogator.insideCase?'先0行动停止练习并退开':sheriff.insideCase?'先0行动停止练习并退开':arbiter.insideCase?'先0行动放回原记录并结束交谈':briber.insideCase?'先0行动结束本次给予与练习':barbarian.insideCase?'先0行动放稳原物并结束练习':lawyer.insideCase?'先0行动放回原记录并结束交谈':lucky.insideCase?'先0行动结束事项并归还原件':machine.insideCase?'先0行动停止练习并退开':monster.insideCase?'先0行动结束注意并退开':werewolf.insideCase?'先实际度过月圆或返回原现场':madman.insideCase?'先0行动实际停止本次练习':prisoner.insideCase?'先0行动交还原木撑':serialKiller.insideCase?'先0行动实际关闭练习并退开':unwinged.insideCase?'先0行动实际停手退开，结束这次冲动':criminal.insideCase?'先0行动交还原工钱袋':shadowAscetic.insideCase?'先0行动解除本次藏匿，沿原路退出':listener.insideCase?'先0行动沿原门退到约定外间，结束本次接触':secretSupplicant.insideCase?'先0行动把原罩盖回':wizard.insideCase?'先0行动结束本次短时效果':combatScholar.insideCase?'先0行动实际停止本次演练':pryer.insideCase?'先0行动实际合上原页':instigator.insideCase?'先0行动停止挑动并退开':assassin.insideCase?'先沿原楼梯或足额轻身返回':gladiator.insideCase?'先0行动松手分开，结束实际接触':s.tamer.companionId!==null?'先完成动物协助或0行动送回原主人':s.status!=='ACTIVE'?'本次试玩已收尾':s.activeEvent?'请先处理当前事件':s.combat?'正在进行追击战斗':null,activeEvent:currentEvent(s),combat,lastCombatRound:publicCombatRound(s.lastCombatRound),combatHistory:s.combatHistory.map(round=>publicCombatRound(round)!),lastResult:clone(s.lastResult),lastCheck:projectThunderGodLastCheck(s),chronicle:clone(s.chronicle),knowledge:clone(s.knowledge),ending:clone(s.ending),nextStep:hasCurrentErrorAscentHistory?errorAscent.nextStep:hasCurrentDoorHistory?door.nextStep:hasCurrentDeathHistory?death.nextStep:hasCurrentSunHistory?sun.nextStep:hasCurrentTyrantHistory?tyrant.nextStep:hasCurrentWhiteTowerHistory?whiteTower.nextStep:hasCurrentDarknessHistory?darkness.nextStep:hasCurrentMoonHistory?moon.nextStep:hasCurrentPerfecterHistory?perfecter.nextStep:hasCurrentVisionaryHistory?visionary.nextStep:nextStep(s),aidCanCancel:s.aid==='ACCEPTED'||s.aid==='CORRECT',marketUnlocked:s.marketUnlocked};
  return projectPlayerText({ ...result, recovery: projectRecovery(s, result) }, s.character.name);
}

/** A session owns its full slice and every engine head. Opening is intentionally
 * strict; no caller-created prepared object or flag can mint a trusted draft. */
export function openFoolRuntimeSession(input:unknown):FoolRuntimeSession {
  const opened=openValidatedFoolSlice(input);
  type Head={state:SliceState;engine:FoolOwnedEngine};
  let current:Head=opened;
  const drafts=new WeakMap<FoolRuntimeDraft,{base:Head;next:Head}>();
  const inspect=(head:Head):FoolRuntimeIdentity=>({runId:head.state.runId,revision:head.state.revision,status:head.state.status});
  const draftHead=(draft:FoolRuntimeDraft):Head=>{
    const entry=drafts.get(draft);
    requireRule(!!entry&&entry.base===current,'草稿不是本会话的当前版本，不能继续使用。');
    return entry!.next;
  };
  const projectFoolHead=(head:Head):FoolProjection=>projectOwnedFool(head.state,head.engine);
  const projectHead=(head:Head):SliceProjection=>structuredClone(projectSliceStateCurrent(structuredClone(head.state),projectFoolHead(head),true,projectRedPriest(head.state),false,projectVisionary(head.state),false,projectPerfecter(head.state),false,projectMoon(head.state),false,projectDarkness(head.state),false,projectWhiteTower(head.state),false));
  return Object.freeze({
    inspect:()=>inspect(current),
    snapshot:()=>structuredClone(current.state),
    project:()=>projectHead(current),
    projectFool:()=>projectFoolHead(current),
    prepare:(intent:SliceIntent,expectedRevision:number):FoolRuntimeDraft=>{
      requireRule(Number.isSafeInteger(expectedRevision)&&expectedRevision===current.state.revision,'当前版本已变化，请刷新后再操作。');
      requireRule(validateSlicePayload(intent)&&intent.type==='FOOL','原有经历已经封存，请在当前筹备处与现场继续行动。');
      const payload=structuredClone(intent) as Extract<SliceIntent,{type:'FOOL'}>;
      const candidate=applyFoolSliceIntent(current.state,payload,current.engine);
      requireRule(!!candidate.head,'当前行动未产生有效领域草稿。');
      assertValidOwnedFoolTransition(current.state,candidate.state);
      assertOwnedFoolCurrent(candidate.state,candidate.head!);
      const draft=Object.freeze({}) as FoolRuntimeDraft;
      drafts.set(draft,{base:current,next:{state:candidate.state,engine:candidate.head!}});return draft;
    },
    inspectDraft:(draft:FoolRuntimeDraft)=>inspect(draftHead(draft)),
    snapshotDraft:(draft:FoolRuntimeDraft)=>structuredClone(draftHead(draft).state),
    projectDraft:(draft:FoolRuntimeDraft)=>projectHead(draftHead(draft)),
    projectDraftFool:(draft:FoolRuntimeDraft)=>projectFoolHead(draftHead(draft)),
    commit:(draft:FoolRuntimeDraft)=>{const next=draftHead(draft);current=next;drafts.delete(draft);},
    discard:(draft:FoolRuntimeDraft)=>{draftHead(draft);drafts.delete(draft);},
  });
}

export function openRedPriestRuntimeSession(input:unknown):RedPriestRuntimeSession {
  const opened=openValidatedRedPriestSlice(input);
  type Head={state:SliceState;engine:RedPriestOwnedEngine};
  let current:Head=opened;
  const drafts=new WeakMap<RedPriestRuntimeDraft,{base:Head;next:Head}>();
  const inspect=(head:Head):RedPriestRuntimeIdentity=>({runId:head.state.runId,revision:head.state.revision,status:head.state.status});
  const draftHead=(draft:RedPriestRuntimeDraft):Head=>{
    const entry=drafts.get(draft);
    requireRule(!!entry&&entry.base===current,'草稿不是本会话的当前版本，不能继续使用。');
    return entry!.next;
  };
  const projectRedPriestHead=(head:Head):RedPriestProjection=>projectOwnedRedPriest(head.state,head.engine);
  const projectHead=(head:Head):SliceProjection=>structuredClone(projectSliceStateCurrent(structuredClone(head.state),projectFool(head.state),false,projectRedPriestHead(head),true,projectVisionary(head.state),false,projectPerfecter(head.state),false,projectMoon(head.state),false,projectDarkness(head.state),false,projectWhiteTower(head.state),false));
  return Object.freeze({
    inspect:()=>inspect(current),
    snapshot:()=>structuredClone(current.state),
    project:()=>projectHead(current),
    projectRedPriest:()=>projectRedPriestHead(current),
    prepare:(intent:SliceIntent,expectedRevision:number):RedPriestRuntimeDraft=>{
      requireRule(Number.isSafeInteger(expectedRevision)&&expectedRevision===current.state.revision,'当前版本已变化，请刷新后再操作。');
      requireRule(validateSlicePayload(intent)&&intent.type==='RED_PRIEST','原有经历已经封存，请在当前筹备处与现场继续行动。');
      const payload=structuredClone(intent) as Extract<SliceIntent,{type:'RED_PRIEST'}>;
      const candidate=applyRedPriestSliceIntent(current.state,payload,current.engine);
      requireRule(!!candidate.head,'当前行动未产生有效领域草稿。');
      assertValidOwnedRedPriestTransition(current.state,candidate.state);
      assertOwnedRedPriestCurrent(candidate.state,candidate.head!);
      const draft=Object.freeze({}) as RedPriestRuntimeDraft;
      drafts.set(draft,{base:current,next:{state:candidate.state,engine:candidate.head!}});return draft;
    },
    inspectDraft:(draft:RedPriestRuntimeDraft)=>inspect(draftHead(draft)),
    snapshotDraft:(draft:RedPriestRuntimeDraft)=>structuredClone(draftHead(draft).state),
    projectDraft:(draft:RedPriestRuntimeDraft)=>projectHead(draftHead(draft)),
    projectDraftRedPriest:(draft:RedPriestRuntimeDraft)=>projectRedPriestHead(draftHead(draft)),
    commit:(draft:RedPriestRuntimeDraft)=>{const next=draftHead(draft);current=next;drafts.delete(draft);},
    discard:(draft:RedPriestRuntimeDraft)=>{draftHead(draft);drafts.delete(draft);},
  });
}

export function openVisionaryRuntimeSession(input:unknown):VisionaryRuntimeSession {
  const opened=openValidatedVisionarySlice(input);
  type Head={state:SliceState;engine:VisionaryOwnedEngine};
  let current:Head=opened;
  const drafts=new WeakMap<VisionaryRuntimeDraft,{base:Head;next:Head}>();
  const inspect=(head:Head):VisionaryRuntimeIdentity=>({runId:head.state.runId,revision:head.state.revision,status:head.state.status});
  const draftHead=(draft:VisionaryRuntimeDraft):Head=>{
    const entry=drafts.get(draft);
    requireRule(!!entry&&entry.base===current,'草稿不是本会话的当前版本，不能继续使用。');
    return entry!.next;
  };
  const projectVisionaryHead=(head:Head):VisionaryProjection=>projectOwnedVisionary(head.state,head.engine);
  const projectHead=(head:Head):SliceProjection=>structuredClone(projectSliceStateCurrent(structuredClone(head.state),projectFool(head.state),false,projectRedPriest(head.state),false,projectVisionaryHead(head),true,projectPerfecter(head.state),false,projectMoon(head.state),false,projectDarkness(head.state),false,projectWhiteTower(head.state),false));
  return Object.freeze({
    inspect:()=>inspect(current),
    snapshot:()=>structuredClone(current.state),
    project:()=>projectHead(current),
    projectVisionary:()=>projectVisionaryHead(current),
    prepare:(intent:SliceIntent,expectedRevision:number):VisionaryRuntimeDraft=>{
      requireRule(Number.isSafeInteger(expectedRevision)&&expectedRevision===current.state.revision,'当前版本已变化，请刷新后再操作。');
      requireRule(validateSlicePayload(intent)&&intent.type==='VISIONARY','原有经历已经封存，请在当前筹备处与现场继续行动。');
      const payload=structuredClone(intent) as Extract<SliceIntent,{type:'VISIONARY'}>;
      const candidate=applyVisionarySliceIntent(current.state,payload,current.engine);
      requireRule(!!candidate.head,'当前行动未产生有效领域草稿。');
      assertValidOwnedVisionaryTransition(current.state,candidate.state);
      assertOwnedVisionaryCurrent(candidate.state,candidate.head!);
      const draft=Object.freeze({}) as VisionaryRuntimeDraft;
      drafts.set(draft,{base:current,next:{state:candidate.state,engine:candidate.head!}});return draft;
    },
    inspectDraft:(draft:VisionaryRuntimeDraft)=>inspect(draftHead(draft)),
    snapshotDraft:(draft:VisionaryRuntimeDraft)=>structuredClone(draftHead(draft).state),
    projectDraft:(draft:VisionaryRuntimeDraft)=>projectHead(draftHead(draft)),
    projectDraftVisionary:(draft:VisionaryRuntimeDraft)=>projectVisionaryHead(draftHead(draft)),
    commit:(draft:VisionaryRuntimeDraft)=>{const next=draftHead(draft);current=next;drafts.delete(draft);},
    discard:(draft:VisionaryRuntimeDraft)=>{draftHead(draft);drafts.delete(draft);},
  });
}

export function openPerfecterRuntimeSession(input:unknown):PerfecterRuntimeSession {
  const opened=openValidatedPerfecterSlice(input);
  type Head={state:SliceState;engine:PerfecterOwnedEngine};
  let current:Head=opened;
  const drafts=new WeakMap<PerfecterRuntimeDraft,{base:Head;next:Head}>();
  const inspect=(head:Head):PerfecterRuntimeIdentity=>({runId:head.state.runId,revision:head.state.revision,status:head.state.status});
  const draftHead=(draft:PerfecterRuntimeDraft):Head=>{
    const entry=drafts.get(draft);
    requireRule(!!entry&&entry.base===current,'草稿不是本会话的当前版本，不能继续使用。');
    return entry!.next;
  };
  const projectPerfecterHead=(head:Head):PerfecterProjection=>projectOwnedPerfecter(head.state,head.engine);
  const projectHead=(head:Head):SliceProjection=>structuredClone(projectSliceStateCurrent(structuredClone(head.state),projectFool(head.state),false,projectRedPriest(head.state),false,projectVisionary(head.state),false,projectPerfecterHead(head),true,projectMoon(head.state),false,projectDarkness(head.state),false,projectWhiteTower(head.state),false));
  return Object.freeze({
    inspect:()=>inspect(current),
    snapshot:()=>structuredClone(current.state),
    project:()=>projectHead(current),
    projectPerfecter:()=>projectPerfecterHead(current),
    prepare:(intent:SliceIntent,expectedRevision:number):PerfecterRuntimeDraft=>{
      requireRule(Number.isSafeInteger(expectedRevision)&&expectedRevision===current.state.revision,'当前版本已变化，请刷新后再操作。');
      requireRule(validateSlicePayload(intent)&&intent.type==='PERFECTER','原有经历已经封存，请在当前筹备处与现场继续行动。');
      const payload=structuredClone(intent) as Extract<SliceIntent,{type:'PERFECTER'}>;
      const candidate=applyPerfecterSliceIntent(current.state,payload,current.engine);
      requireRule(!!candidate.head,'当前行动未产生有效领域草稿。');
      assertValidOwnedPerfecterTransition(current.state,candidate.state);
      assertOwnedPerfecterCurrent(candidate.state,candidate.head!);
      const draft=Object.freeze({}) as PerfecterRuntimeDraft;
      drafts.set(draft,{base:current,next:{state:candidate.state,engine:candidate.head!}});return draft;
    },
    inspectDraft:(draft:PerfecterRuntimeDraft)=>inspect(draftHead(draft)),
    snapshotDraft:(draft:PerfecterRuntimeDraft)=>structuredClone(draftHead(draft).state),
    projectDraft:(draft:PerfecterRuntimeDraft)=>projectHead(draftHead(draft)),
    projectDraftPerfecter:(draft:PerfecterRuntimeDraft)=>projectPerfecterHead(draftHead(draft)),
    commit:(draft:PerfecterRuntimeDraft)=>{const next=draftHead(draft);current=next;drafts.delete(draft);},
    discard:(draft:PerfecterRuntimeDraft)=>{draftHead(draft);drafts.delete(draft);},
  });
}

export function openMoonRuntimeSession(input:unknown):MoonRuntimeSession {
  const opened=openValidatedMoonSlice(input);
  type Head={state:SliceState;engine:MoonOwnedEngine};
  let current:Head=opened;
  const drafts=new WeakMap<MoonRuntimeDraft,{base:Head;next:Head}>();
  const inspect=(head:Head):MoonRuntimeIdentity=>({runId:head.state.runId,revision:head.state.revision,status:head.state.status});
  const draftHead=(draft:MoonRuntimeDraft):Head=>{
    const entry=drafts.get(draft);
    requireRule(!!entry&&entry.base===current,'草稿不是本会话的当前版本，不能继续使用。');
    return entry!.next;
  };
  const projectMoonHead=(head:Head):MoonProjection=>projectOwnedMoon(head.state,head.engine);
  const projectHead=(head:Head):SliceProjection=>structuredClone(projectSliceStateCurrent(structuredClone(head.state),projectFool(head.state),false,projectRedPriest(head.state),false,projectVisionary(head.state),false,projectPerfecter(head.state),false,projectMoonHead(head),true,projectDarkness(head.state),false,projectWhiteTower(head.state),false));
  return Object.freeze({
    inspect:()=>inspect(current),
    snapshot:()=>structuredClone(current.state),
    project:()=>projectHead(current),
    projectMoon:()=>projectMoonHead(current),
    prepare:(intent:SliceIntent,expectedRevision:number):MoonRuntimeDraft=>{
      requireRule(Number.isSafeInteger(expectedRevision)&&expectedRevision===current.state.revision,'当前版本已变化，请刷新后再操作。');
      requireRule(validateSlicePayload(intent)&&intent.type==='MOON','原有经历已经封存，请在当前筹备处与现场继续行动。');
      const payload=structuredClone(intent) as Extract<SliceIntent,{type:'MOON'}>;
      const candidate=applyMoonSliceIntent(current.state,payload,current.engine);
      requireRule(!!candidate.head,'当前行动未产生有效领域草稿。');
      assertValidOwnedMoonTransition(current.state,candidate.state);
      assertOwnedMoonCurrent(candidate.state,candidate.head!);
      const draft=Object.freeze({}) as MoonRuntimeDraft;
      drafts.set(draft,{base:current,next:{state:candidate.state,engine:candidate.head!}});return draft;
    },
    inspectDraft:(draft:MoonRuntimeDraft)=>inspect(draftHead(draft)),
    snapshotDraft:(draft:MoonRuntimeDraft)=>structuredClone(draftHead(draft).state),
    projectDraft:(draft:MoonRuntimeDraft)=>projectHead(draftHead(draft)),
    projectDraftMoon:(draft:MoonRuntimeDraft)=>projectMoonHead(draftHead(draft)),
    commit:(draft:MoonRuntimeDraft)=>{const next=draftHead(draft);current=next;drafts.delete(draft);},
    discard:(draft:MoonRuntimeDraft)=>{draftHead(draft);drafts.delete(draft);},
  });
}

export function openDarknessRuntimeSession(input:unknown):DarknessRuntimeSession {
  const opened=openValidatedDarknessSlice(input);
  type Head={state:SliceState;engine:DarknessOwnedEngine};
  let current:Head=opened;
  const drafts=new WeakMap<DarknessRuntimeDraft,{base:Head;next:Head}>();
  const inspect=(head:Head):DarknessRuntimeIdentity=>({runId:head.state.runId,revision:head.state.revision,status:head.state.status});
  const draftHead=(draft:DarknessRuntimeDraft):Head=>{
    const entry=drafts.get(draft);
    requireRule(!!entry&&entry.base===current,'草稿不是本会话的当前版本，不能继续使用。');
    return entry!.next;
  };
  const projectDarknessHead=(head:Head):DarknessProjection=>projectOwnedDarkness(head.state,head.engine);
  const projectHead=(head:Head):SliceProjection=>structuredClone(projectSliceStateCurrent(structuredClone(head.state),projectFool(head.state),false,projectRedPriest(head.state),false,projectVisionary(head.state),false,projectPerfecter(head.state),false,projectMoon(head.state),false,projectDarknessHead(head),true,projectWhiteTower(head.state),false));
  return Object.freeze({
    inspect:()=>inspect(current),
    snapshot:()=>structuredClone(current.state),
    project:()=>projectHead(current),
    projectDarkness:()=>projectDarknessHead(current),
    prepare:(intent:SliceIntent,expectedRevision:number):DarknessRuntimeDraft=>{
      requireRule(Number.isSafeInteger(expectedRevision)&&expectedRevision===current.state.revision,'当前版本已变化，请刷新后再操作。');
      requireRule(validateSlicePayload(intent)&&intent.type==='DARKNESS','原有经历已经封存，请在当前筹备处与现场继续行动。');
      const payload=structuredClone(intent) as Extract<SliceIntent,{type:'DARKNESS'}>;
      const candidate=applyDarknessSliceIntent(current.state,payload,current.engine);
      requireRule(!!candidate.head,'当前行动未产生有效领域草稿。');
      assertValidOwnedDarknessTransition(current.state,candidate.state);
      assertOwnedDarknessCurrent(candidate.state,candidate.head!);
      const draft=Object.freeze({}) as DarknessRuntimeDraft;
      drafts.set(draft,{base:current,next:{state:candidate.state,engine:candidate.head!}});return draft;
    },
    inspectDraft:(draft:DarknessRuntimeDraft)=>inspect(draftHead(draft)),
    snapshotDraft:(draft:DarknessRuntimeDraft)=>structuredClone(draftHead(draft).state),
    projectDraft:(draft:DarknessRuntimeDraft)=>projectHead(draftHead(draft)),
    projectDraftDarkness:(draft:DarknessRuntimeDraft)=>projectDarknessHead(draftHead(draft)),
    commit:(draft:DarknessRuntimeDraft)=>{const next=draftHead(draft);current=next;drafts.delete(draft);},
    discard:(draft:DarknessRuntimeDraft)=>{draftHead(draft);drafts.delete(draft);},
  });
}

export function openWhiteTowerRuntimeSession(input:unknown):WhiteTowerRuntimeSession {
  const opened=openValidatedWhiteTowerSlice(input);
  type Head={state:SliceState;engine:WhiteTowerOwnedEngine};
  let current:Head=opened;
  const drafts=new WeakMap<WhiteTowerRuntimeDraft,{base:Head;next:Head}>();
  const inspect=(head:Head):WhiteTowerRuntimeIdentity=>({runId:head.state.runId,revision:head.state.revision,status:head.state.status});
  const draftHead=(draft:WhiteTowerRuntimeDraft):Head=>{
    const entry=drafts.get(draft);
    requireRule(!!entry&&entry.base===current,'草稿不是本会话的当前版本，不能继续使用。');
    return entry!.next;
  };
  const projectWhiteTowerHead=(head:Head):WhiteTowerProjection=>projectOwnedWhiteTower(head.state,head.engine);
  const projectHead=(head:Head):SliceProjection=>structuredClone(projectSliceStateCurrent(structuredClone(head.state),projectFool(head.state),false,projectRedPriest(head.state),false,projectVisionary(head.state),false,projectPerfecter(head.state),false,projectMoon(head.state),false,projectDarkness(head.state),false,projectWhiteTowerHead(head),true));
  return Object.freeze({
    inspect:()=>inspect(current),
    snapshot:()=>structuredClone(current.state),
    project:()=>projectHead(current),
    projectWhiteTower:()=>projectWhiteTowerHead(current),
    prepare:(intent:SliceIntent,expectedRevision:number):WhiteTowerRuntimeDraft=>{
      requireRule(Number.isSafeInteger(expectedRevision)&&expectedRevision===current.state.revision,'当前版本已变化，请刷新后再操作。');
      requireRule(validateSlicePayload(intent)&&intent.type==='WHITE_TOWER','原有经历已经封存，请在当前筹备处与现场继续行动。');
      const payload=structuredClone(intent) as Extract<SliceIntent,{type:'WHITE_TOWER'}>;
      const candidate=applyWhiteTowerSliceIntent(current.state,payload,current.engine);
      requireRule(!!candidate.head,'当前行动未产生有效领域草稿。');
      assertValidOwnedWhiteTowerTransition(current.state,candidate.state);
      assertOwnedWhiteTowerCurrent(candidate.state,candidate.head!);
      const draft=Object.freeze({}) as WhiteTowerRuntimeDraft;
      drafts.set(draft,{base:current,next:{state:candidate.state,engine:candidate.head!}});return draft;
    },
    inspectDraft:(draft:WhiteTowerRuntimeDraft)=>inspect(draftHead(draft)),
    snapshotDraft:(draft:WhiteTowerRuntimeDraft)=>structuredClone(draftHead(draft).state),
    projectDraft:(draft:WhiteTowerRuntimeDraft)=>projectHead(draftHead(draft)),
    projectDraftWhiteTower:(draft:WhiteTowerRuntimeDraft)=>projectWhiteTowerHead(draftHead(draft)),
    commit:(draft:WhiteTowerRuntimeDraft)=>{const next=draftHead(draft);current=next;drafts.delete(draft);},
    discard:(draft:WhiteTowerRuntimeDraft)=>{draftHead(draft);drafts.delete(draft);},
  });
}

export function openTyrantRuntimeSession(input:unknown):TyrantRuntimeSession {
  const opened=openValidatedTyrantSlice(input);
  type Head={state:SliceState;engine:TyrantOwnedEngine};
  let current:Head=opened;
  const drafts=new WeakMap<TyrantRuntimeDraft,{base:Head;next:Head}>();
  const inspect=(head:Head):TyrantRuntimeIdentity=>({runId:head.state.runId,revision:head.state.revision,status:head.state.status});
  const draftHead=(draft:TyrantRuntimeDraft):Head=>{
    const entry=drafts.get(draft);
    requireRule(!!entry&&entry.base===current,'草稿不是本会话的当前版本，不能继续使用。');
    return entry!.next;
  };
  const projectTyrantHead=(head:Head):TyrantProjection=>projectOwnedTyrant(head.state,head.engine);
  const projectHead=(head:Head):SliceProjection=>structuredClone(projectSliceStateCurrent(structuredClone(head.state),projectFool(head.state),false,projectRedPriest(head.state),false,projectVisionary(head.state),false,projectPerfecter(head.state),false,projectMoon(head.state),false,projectDarkness(head.state),false,projectWhiteTower(head.state),false,projectTyrantHead(head),true));
  return Object.freeze({
    inspect:()=>inspect(current),
    snapshot:()=>structuredClone(current.state),
    project:()=>projectHead(current),
    projectTyrant:()=>projectTyrantHead(current),
    prepare:(intent:SliceIntent,expectedRevision:number):TyrantRuntimeDraft=>{
      requireRule(Number.isSafeInteger(expectedRevision)&&expectedRevision===current.state.revision,'当前版本已变化，请刷新后再操作。');
      requireRule(validateSlicePayload(intent)&&intent.type==='TYRANT','原有经历已经封存，请在当前筹备处与现场继续行动。');
      const payload=structuredClone(intent) as Extract<SliceIntent,{type:'TYRANT'}>;
      const candidate=applyTyrantSliceIntent(current.state,payload,current.engine);
      requireRule(!!candidate.head,'当前行动未产生有效领域草稿。');
      assertValidOwnedTyrantTransition(current.state,candidate.state);
      assertOwnedTyrantCurrent(candidate.state,candidate.head!);
      const draft=Object.freeze({}) as TyrantRuntimeDraft;
      drafts.set(draft,{base:current,next:{state:candidate.state,engine:candidate.head!}});return draft;
    },
    inspectDraft:(draft:TyrantRuntimeDraft)=>inspect(draftHead(draft)),
    snapshotDraft:(draft:TyrantRuntimeDraft)=>structuredClone(draftHead(draft).state),
    projectDraft:(draft:TyrantRuntimeDraft)=>projectHead(draftHead(draft)),
    projectDraftTyrant:(draft:TyrantRuntimeDraft)=>projectTyrantHead(draftHead(draft)),
    commit:(draft:TyrantRuntimeDraft)=>{const next=draftHead(draft);current=next;drafts.delete(draft);},
    discard:(draft:TyrantRuntimeDraft)=>{draftHead(draft);drafts.delete(draft);},
  });
}

export function openSunRuntimeSession(input:unknown):SunRuntimeSession {
  const opened=openValidatedSunSlice(input);
  type Head={state:SliceState;engine:SunOwnedEngine};
  let current:Head=opened;
  const drafts=new WeakMap<SunRuntimeDraft,{base:Head;next:Head}>();
  const inspect=(head:Head):SunRuntimeIdentity=>({runId:head.state.runId,revision:head.state.revision,status:head.state.status});
  const draftHead=(draft:SunRuntimeDraft):Head=>{
    const entry=drafts.get(draft);
    requireRule(!!entry&&entry.base===current,'草稿不是本会话的当前版本，不能继续使用。');
    return entry!.next;
  };
  const projectSunHead=(head:Head):SunProjection=>projectOwnedSun(head.state,head.engine);
  const projectHead=(head:Head):SliceProjection=>structuredClone(projectSliceStateCurrent(structuredClone(head.state),projectFool(head.state),false,projectRedPriest(head.state),false,projectVisionary(head.state),false,projectPerfecter(head.state),false,projectMoon(head.state),false,projectDarkness(head.state),false,projectWhiteTower(head.state),false,projectTyrant(head.state),false,projectSunHead(head),true));
  return Object.freeze({
    inspect:()=>inspect(current),
    snapshot:()=>structuredClone(current.state),
    project:()=>projectHead(current),
    projectSun:()=>projectSunHead(current),
    prepare:(intent:SliceIntent,expectedRevision:number):SunRuntimeDraft=>{
      requireRule(Number.isSafeInteger(expectedRevision)&&expectedRevision===current.state.revision,'当前版本已变化，请刷新后再操作。');
      requireRule(validateSlicePayload(intent)&&intent.type==='SUN','原有经历已经封存，请在当前筹备处与现场继续行动。');
      const payload=structuredClone(intent) as Extract<SliceIntent,{type:'SUN'}>;
      const candidate=applySunSliceIntent(current.state,payload,current.engine);
      requireRule(!!candidate.head,'当前行动未产生有效领域草稿。');
      assertValidOwnedSunTransition(current.state,candidate.state);
      assertOwnedSunCurrent(candidate.state,candidate.head!);
      const draft=Object.freeze({}) as SunRuntimeDraft;
      drafts.set(draft,{base:current,next:{state:candidate.state,engine:candidate.head!}});return draft;
    },
    inspectDraft:(draft:SunRuntimeDraft)=>inspect(draftHead(draft)),
    snapshotDraft:(draft:SunRuntimeDraft)=>structuredClone(draftHead(draft).state),
    projectDraft:(draft:SunRuntimeDraft)=>projectHead(draftHead(draft)),
    projectDraftSun:(draft:SunRuntimeDraft)=>projectSunHead(draftHead(draft)),
    commit:(draft:SunRuntimeDraft)=>{const next=draftHead(draft);current=next;drafts.delete(draft);},
    discard:(draft:SunRuntimeDraft)=>{draftHead(draft);drafts.delete(draft);},
  });
}

export function openDeathRuntimeSession(input:unknown):DeathRuntimeSession {
  const opened=openValidatedDeathSlice(input);
  type Head={state:SliceState;engine:DeathOwnedEngine};
  let current:Head=opened;
  const drafts=new WeakMap<DeathRuntimeDraft,{base:Head;next:Head}>();
  const inspect=(head:Head):DeathRuntimeIdentity=>({runId:head.state.runId,revision:head.state.revision,status:head.state.status});
  const draftHead=(draft:DeathRuntimeDraft):Head=>{
    const entry=drafts.get(draft);
    requireRule(!!entry&&entry.base===current,'草稿不是本会话的当前版本，不能继续使用。');
    return entry!.next;
  };
  const projectDeathHead=(head:Head):DeathProjection=>projectOwnedDeath(head.state,head.engine);
  const projectHead=(head:Head):SliceProjection=>structuredClone(projectSliceStateCurrent(structuredClone(head.state),projectFool(head.state),false,projectRedPriest(head.state),false,projectVisionary(head.state),false,projectPerfecter(head.state),false,projectMoon(head.state),false,projectDarkness(head.state),false,projectWhiteTower(head.state),false,projectTyrant(head.state),false,projectSun(head.state),false,projectDeathHead(head),true));
  return Object.freeze({
    inspect:()=>inspect(current),
    snapshot:()=>structuredClone(current.state),
    project:()=>projectHead(current),
    projectDeath:()=>projectDeathHead(current),
    prepare:(intent:SliceIntent,expectedRevision:number):DeathRuntimeDraft=>{
      requireRule(Number.isSafeInteger(expectedRevision)&&expectedRevision===current.state.revision,'当前版本已变化，请刷新后再操作。');
      requireRule(validateSlicePayload(intent)&&intent.type==='DEATH','原有经历已经封存，请在当前筹备处与现场继续行动。');
      const payload=structuredClone(intent) as Extract<SliceIntent,{type:'DEATH'}>;
      const candidate=applyDeathSliceIntent(current.state,payload,current.engine);
      requireRule(!!candidate.head,'当前行动未产生有效领域草稿。');
      assertValidOwnedDeathTransition(current.state,candidate.state);
      assertOwnedDeathCurrent(candidate.state,candidate.head!);
      const draft=Object.freeze({}) as DeathRuntimeDraft;
      drafts.set(draft,{base:current,next:{state:candidate.state,engine:candidate.head!}});return draft;
    },
    inspectDraft:(draft:DeathRuntimeDraft)=>inspect(draftHead(draft)),
    snapshotDraft:(draft:DeathRuntimeDraft)=>structuredClone(draftHead(draft).state),
    projectDraft:(draft:DeathRuntimeDraft)=>projectHead(draftHead(draft)),
    projectDraftDeath:(draft:DeathRuntimeDraft)=>projectDeathHead(draftHead(draft)),
    commit:(draft:DeathRuntimeDraft)=>{const next=draftHead(draft);current=next;drafts.delete(draft);},
    discard:(draft:DeathRuntimeDraft)=>{draftHead(draft);drafts.delete(draft);},
  });
}

export function openDoorRuntimeSession(input:unknown):DoorRuntimeSession {
  const opened=openValidatedDoorSlice(input);
  type Head={state:SliceState;engine:DoorOwnedEngine};
  let current:Head=opened;
  const drafts=new WeakMap<DoorRuntimeDraft,{base:Head;next:Head}>();
  const inspect=(head:Head):DoorRuntimeIdentity=>({runId:head.state.runId,revision:head.state.revision,status:head.state.status});
  const draftHead=(draft:DoorRuntimeDraft):Head=>{
    const entry=drafts.get(draft);
    requireRule(!!entry&&entry.base===current,'草稿不是本会话的当前版本，不能继续使用。');
    return entry!.next;
  };
  const projectDoorHead=(head:Head):DoorProjection=>projectOwnedDoor(head.state,head.engine);
  const projectHead=(head:Head):SliceProjection=>structuredClone(projectSliceStateCurrent(structuredClone(head.state),projectFool(head.state),false,projectRedPriest(head.state),false,projectVisionary(head.state),false,projectPerfecter(head.state),false,projectMoon(head.state),false,projectDarkness(head.state),false,projectWhiteTower(head.state),false,projectTyrant(head.state),false,projectSun(head.state),false,projectDeath(head.state),false,projectDoorHead(head),true));
  return Object.freeze({
    inspect:()=>inspect(current),
    snapshot:()=>structuredClone(current.state),
    project:()=>projectHead(current),
    projectDoor:()=>projectDoorHead(current),
    prepare:(intent:SliceIntent,expectedRevision:number):DoorRuntimeDraft=>{
      requireRule(Number.isSafeInteger(expectedRevision)&&expectedRevision===current.state.revision,'当前版本已变化，请刷新后再操作。');
      requireRule(validateSlicePayload(intent)&&intent.type==='DOOR','原有经历已经封存，请在当前筹备处与现场继续行动。');
      const payload=structuredClone(intent) as Extract<SliceIntent,{type:'DOOR'}>;
      const candidate=applyDoorSliceIntent(current.state,payload,current.engine);
      requireRule(!!candidate.head,'当前行动未产生有效领域草稿。');
      assertValidOwnedDoorTransition(current.state,candidate.state);
      assertOwnedDoorCurrent(candidate.state,candidate.head!);
      const draft=Object.freeze({}) as DoorRuntimeDraft;
      drafts.set(draft,{base:current,next:{state:candidate.state,engine:candidate.head!}});return draft;
    },
    inspectDraft:(draft:DoorRuntimeDraft)=>inspect(draftHead(draft)),
    snapshotDraft:(draft:DoorRuntimeDraft)=>structuredClone(draftHead(draft).state),
    projectDraft:(draft:DoorRuntimeDraft)=>projectHead(draftHead(draft)),
    projectDraftDoor:(draft:DoorRuntimeDraft)=>projectDoorHead(draftHead(draft)),
    commit:(draft:DoorRuntimeDraft)=>{const next=draftHead(draft);current=next;drafts.delete(draft);},
    discard:(draft:DoorRuntimeDraft)=>{draftHead(draft);drafts.delete(draft);},
  });
}

export function openErrorAscentRuntimeSession(input:unknown):ErrorAscentRuntimeSession {
  const opened=openValidatedErrorAscentSlice(input);
  type Head={state:SliceState;engine:ErrorAscentOwnedEngine};
  let current:Head=opened;
  const drafts=new WeakMap<ErrorAscentRuntimeDraft,{base:Head;next:Head}>();
  const inspect=(head:Head):ErrorAscentRuntimeIdentity=>({runId:head.state.runId,revision:head.state.revision,status:head.state.status});
  const draftHead=(draft:ErrorAscentRuntimeDraft):Head=>{
    const entry=drafts.get(draft);
    requireRule(!!entry&&entry.base===current,'草稿不是本会话的当前版本，不能继续使用。');
    return entry!.next;
  };
  const projectErrorAscentHead=(head:Head):ErrorAscentProjection=>projectOwnedErrorAscent(head.state,head.engine);
  const projectHead=(head:Head):SliceProjection=>structuredClone(projectSliceStateCurrent(structuredClone(head.state),projectFool(head.state),false,projectRedPriest(head.state),false,projectVisionary(head.state),false,projectPerfecter(head.state),false,projectMoon(head.state),false,projectDarkness(head.state),false,projectWhiteTower(head.state),false,projectTyrant(head.state),false,projectSun(head.state),false,projectDeath(head.state),false,projectDoor(head.state),false,projectErrorAscentHead(head),true));
  return Object.freeze({
    inspect:()=>inspect(current),
    snapshot:()=>structuredClone(current.state),
    project:()=>projectHead(current),
    projectErrorAscent:()=>projectErrorAscentHead(current),
    prepare:(intent:SliceIntent,expectedRevision:number):ErrorAscentRuntimeDraft=>{
      requireRule(Number.isSafeInteger(expectedRevision)&&expectedRevision===current.state.revision,'当前版本已变化，请刷新后再操作。');
      requireRule(validateSlicePayload(intent)&&intent.type==='ERROR_ASCENT','原有经历已经封存，请在当前筹备处与现场继续行动。');
      const payload=structuredClone(intent) as Extract<SliceIntent,{type:'ERROR_ASCENT'}>;
      const candidate=applyErrorAscentSliceIntent(current.state,payload,current.engine);
      requireRule(!!candidate.head,'当前行动未产生有效领域草稿。');
      assertValidOwnedErrorAscentTransition(current.state,candidate.state);
      assertOwnedErrorAscentCurrent(candidate.state,candidate.head!);
      const draft=Object.freeze({}) as ErrorAscentRuntimeDraft;
      drafts.set(draft,{base:current,next:{state:candidate.state,engine:candidate.head!}});return draft;
    },
    inspectDraft:(draft:ErrorAscentRuntimeDraft)=>inspect(draftHead(draft)),
    snapshotDraft:(draft:ErrorAscentRuntimeDraft)=>structuredClone(draftHead(draft).state),
    projectDraft:(draft:ErrorAscentRuntimeDraft)=>projectHead(draftHead(draft)),
    projectDraftErrorAscent:(draft:ErrorAscentRuntimeDraft)=>projectErrorAscentHead(draftHead(draft)),
    commit:(draft:ErrorAscentRuntimeDraft)=>{const next=draftHead(draft);current=next;drafts.delete(draft);},
    discard:(draft:ErrorAscentRuntimeDraft)=>{draftHead(draft);drafts.delete(draft);},
  });
}
