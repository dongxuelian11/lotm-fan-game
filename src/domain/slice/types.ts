import type { ElderRoundOutcome, ElderCombatProjection } from '../elder/combat.js';
import type { ElderState, ElderCommand, ElderProjection } from '../elder/types.js';
import type { SageRoundOutcome, SageCombatProjection } from '../sage/combat.js';
import type { CalamityDemonessRoundOutcome, CalamityDemonessCombatProjection } from '../calamity-demoness/combat.js';
import type { GloryRoundOutcome, GloryCombatProjection } from '../glory/combat.js';
import type {FateTrojanRoundOutcome,projectFateTrojanCombat} from '../fate-trojan/combat.js';
import type {PlaneswalkerRoundOutcome,projectPlaneswalkerCombat} from '../planeswalker/combat.js';
import type {DeathConsulRoundOutcome,projectDeathConsulCombat} from '../death-consul/combat.js';
import type {LightSeekerRoundOutcome,projectLightSeekerCombat} from '../light-seeker/combat.js';
import type {CatastropheRoundOutcome,projectCatastropheCombat} from '../catastrophe/combat.js';
import type {WisdomAngelRoundOutcome,projectWisdomAngelCombat} from '../wisdom-angel/combat.js';
import type {ConcealmentServantRoundOutcome,projectConcealmentServantCombat} from '../concealment-servant/combat.js';
import type {LifeGiverRoundOutcome,projectLifeGiverCombat} from '../life-giver/combat.js';
import type {KnowledgeMentorRoundOutcome,projectKnowledgeMentorCombat} from '../knowledge-mentor/combat.js';
import type { SageState, SageCommand, SageProjection } from '../sage/types.js';
import type { CalamityDemonessState, CalamityDemonessCommand, CalamityDemonessProjection } from '../calamity-demoness/types.js';
import type { GloryState, GloryCommand, GloryProjection } from '../glory/types.js';
import type {FateTrojanState,FateTrojanCommand,FateTrojanProjection} from '../fate-trojan/types.js';
import type {PlaneswalkerState,PlaneswalkerCommand,PlaneswalkerProjection} from '../planeswalker/types.js';
import type {DeathConsulState,DeathConsulCommand,DeathConsulProjection} from '../death-consul/types.js';
import type {LightSeekerState,LightSeekerCommand,LightSeekerProjection} from '../light-seeker/types.js';
import type {CatastropheState,CatastropheCommand,CatastropheProjection} from '../catastrophe/types.js';
import type {WisdomAngelState,WisdomAngelCommand,WisdomAngelProjection} from '../wisdom-angel/types.js';
import type {ConcealmentServantState,ConcealmentServantCommand,ConcealmentServantProjection} from '../concealment-servant/types.js';
import type {LifeGiverState,LifeGiverCommand,LifeGiverProjection} from '../life-giver/types.js';
import type {KnowledgeMentorState,KnowledgeMentorCommand,KnowledgeMentorProjection} from '../knowledge-mentor/types.js';
import type {DiscernerRoundOutcome,projectDiscernerCombat} from '../discerner/combat.js';
import type {DiscernerState,DiscernerCommand,DiscernerProjection} from '../discerner/types.js';
import type {WeatherWarlockRoundOutcome,projectWeatherWarlockCombat} from '../weather-warlock/combat.js';
import type {WeatherWarlockState,WeatherWarlockCommand,WeatherWarlockProjection} from '../weather-warlock/types.js';
import type {MiracleWorkerRoundOutcome,projectMiracleWorkerCombat} from '../miracle-worker/combat.js';
import type {MiracleWorkerState,MiracleWorkerCommand,MiracleWorkerProjection} from '../miracle-worker/types.js';
import type { SliceRecoveryProjection } from './medical.js';
import type {CoffinBearerRoundOutcome,projectCoffinBearerCombat} from '../coffin-bearer/combat.js';
import type {CoffinBearerState,CoffinBearerCommand,CoffinBearerProjection} from '../coffin-bearer/types.js';
import type {ChaosHunterRoundOutcome,projectChaosHunterCombat} from '../chaos-hunter/combat.js';
import type {ChaosHunterState,ChaosHunterCommand,ChaosHunterProjection} from '../chaos-hunter/types.js';
import type {FrenzyMageRoundOutcome,projectFrenzyMageCombat} from '../frenzy-mage/combat.js';
import type {FrenzyMageState,FrenzyMageCommand,FrenzyMageProjection} from '../frenzy-mage/types.js';
import type {ChaosWalkerRoundOutcome,projectChaosWalkerCombat} from '../chaos-walker/combat.js';
import type {ChaosWalkerState,ChaosWalkerCommand,ChaosWalkerProjection} from '../chaos-walker/types.js';
import type {SilentDiscipleRoundOutcome,projectSilentDiscipleCombat} from '../silent-disciple/combat.js';
import type {SilentDiscipleState,SilentDiscipleCommand,SilentDiscipleProjection} from '../silent-disciple/types.js';
import type {BlathererRoundOutcome,projectBlathererCombat} from '../blatherer/combat.js';
import type {BlathererState,BlathererCommand,BlathererProjection} from '../blatherer/types.js';
import type {ThreeHeadedTemplarRoundOutcome,projectThreeHeadedTemplarCombat} from '../three-headed-templar/combat.js';
import type {ThreeHeadedTemplarState,ThreeHeadedTemplarCommand,ThreeHeadedTemplarProjection} from '../three-headed-templar/types.js';
import type {ProphecyMasterRoundOutcome,projectProphecyMasterCombat} from '../prophecy-master/combat.js';
import type {ProphecyMasterState,ProphecyMasterCommand,ProphecyMasterProjection} from '../prophecy-master/types.js';
import type {UnagingDemonessRoundOutcome,projectUnagingDemonessCombat} from '../unaging-demoness/combat.js';
import type {UnagingDemonessState,UnagingDemonessCommand,UnagingDemonessProjection} from '../unaging-demoness/types.js';
import type {SilverKnightRoundOutcome,projectSilverKnightCombat} from '../silver-knight/combat.js';
import type {SilverKnightState,SilverKnightCommand,SilverKnightProjection} from '../silver-knight/types.js';
import type {DeceitMentorRoundOutcome,projectDeceitMentorCombat} from '../deceit-mentor/combat.js';
import type {DeceitMentorState,DeceitMentorCommand,DeceitMentorProjection} from '../deceit-mentor/types.js';
import type {WandererRoundOutcome,projectWandererCombat} from '../wanderer/combat.js';
import type {WandererState,WandererCommand,WandererProjection} from '../wanderer/types.js';
import type {FerrymanRoundOutcome,projectFerrymanCombat} from '../ferryman/combat.js';
import type {FerrymanState,FerrymanCommand,FerrymanProjection} from '../ferryman/types.js';
import type {JusticeMentorRoundOutcome,projectJusticeMentorCombat} from '../justice-mentor/combat.js';
import type {JusticeMentorState,JusticeMentorCommand,JusticeMentorProjection} from '../justice-mentor/types.js';
import type {SeaKingRoundOutcome,projectSeaKingCombat} from '../sea-king/combat.js';
import type {SeaKingState,SeaKingCommand,SeaKingProjection} from '../sea-king/types.js';
import type {InsightScholarRoundOutcome,projectInsightScholarCombat} from '../insight-scholar/combat.js';
import type {InsightScholarState,InsightScholarCommand,InsightScholarProjection} from '../insight-scholar/types.js';
import type {FearBishopRoundOutcome,projectFearBishopCombat} from '../fear-bishop/combat.js';
import type {FearBishopState,FearBishopCommand,FearBishopProjection} from '../fear-bishop/types.js';
import type {SummoningMasterRoundOutcome,projectSummoningMasterCombat} from '../summoning-master/combat.js';
import type {SummoningMasterState,SummoningMasterCommand,SummoningMasterProjection} from '../summoning-master/types.js';
import type {ArcaneScholarRoundOutcome,projectArcaneScholarCombat} from '../arcane-scholar/combat.js';
import type {ArcaneScholarState,ArcaneScholarCommand,ArcaneScholarProjection} from '../arcane-scholar/types.js';
import type {DreamWeaverRoundOutcome,projectDreamWeaverCombat} from '../dream-weaver/combat.js';
import type {DreamWeaverState,DreamWeaverCommand,DreamWeaverProjection} from '../dream-weaver/types.js';
import type {WarBishopRoundOutcome,projectWarBishopCombat} from '../war-bishop/combat.js';
import type {WarBishopState,WarBishopCommand,WarBishopProjection} from '../war-bishop/types.js';
import type {AncientScholarRoundOutcome,projectAncientScholarCombat} from '../ancient-scholar/combat.js';
import type {AncientScholarState,AncientScholarCommand,AncientScholarProjection} from '../ancient-scholar/types.js';
import type {LongChapterState,LongChapterCommand,LongChapterProjection} from '../long-chapter/types.js';
import type {AncientAlchemistState,AncientAlchemistCommand,AncientAlchemistProjection} from '../ancient-alchemist/types.js';
import type {AncientAlchemistRoundOutcome,projectAncientAlchemistCombat} from '../ancient-alchemist/combat.js';
import type {ImperativeMageState,ImperativeMageCommand,ImperativeMageProjection} from '../imperative-mage/types.js';
import type {ImperativeMageRoundOutcome,projectImperativeMageCombat} from '../imperative-mage/combat.js';
import type {FallenEarlState,FallenEarlCommand,FallenEarlProjection} from '../fallen-earl/types.js';
import type {FallenEarlRoundOutcome,projectFallenEarlCombat} from '../fallen-earl/combat.js';
import type {MisfortuneMageState,MisfortuneMageCommand,MisfortuneMageProjection} from '../misfortune-mage/types.js';
import type {MisfortuneMageRoundOutcome,projectMisfortuneMageCombat} from '../misfortune-mage/combat.js';
import type {PuppetState,PuppetCommand,PuppetProjection} from '../puppet/types.js';
import type {PuppetRoundOutcome,projectPuppetCombat} from '../puppet/combat.js';
import type {DevilState,DevilCommand,DevilProjection} from '../devil/types.js';
import type {DevilRoundOutcome,projectDevilCombat} from '../devil/combat.js';
import type {BlackKnightState,BlackKnightCommand,BlackKnightProjection} from '../black-knight/types.js';
import type {BlackKnightRoundOutcome,projectBlackKnightCombat} from '../black-knight/combat.js';
import type {MysticState,MysticCommand,MysticProjection} from '../mystic/types.js';
import type {MysticRoundOutcome,projectMysticCombat} from '../mystic/combat.js';
import type {DespairState,DespairCommand,DespairProjection} from '../despair/types.js';
import type {DespairRoundOutcome,projectDespairCombat} from '../despair/combat.js';
import type {DemonHunterState,DemonHunterCommand,DemonHunterProjection} from '../demon-hunter/types.js';
import type {DemonHunterRoundOutcome,projectDemonHunterCombat} from '../demon-hunter/combat.js';
import type {ParasiteState,ParasiteCommand,ParasiteProjection} from '../parasite/types.js';
import type {ParasiteRoundOutcome,projectParasiteCombat} from '../parasite/combat.js';
import type {SecretsSorcererState,SecretsSorcererCommand,SecretsSorcererProjection} from '../secrets-sorcerer/types.js';
import type {SecretsSorcererRoundOutcome,projectSecretsSorcererCombat} from '../secrets-sorcerer/combat.js';
import type {projectUndyingCombat} from '../undying/combat.js';
import type {UndyingState,UndyingCommand,UndyingProjection} from '../undying/types.js';
import type {UndyingRoundOutcome} from '../undying/combat.js';
import type {projectUnshadowedCombat} from '../unshadowed/combat.js';
import type {UnshadowedState,UnshadowedCommand,UnshadowedProjection} from '../unshadowed/types.js';
import type {UnshadowedRoundOutcome} from '../unshadowed/combat.js';
import type {projectCataclysmPriestCombat} from '../cataclysm-priest/combat.js';
import type {CataclysmPriestState,CataclysmPriestCommand,CataclysmPriestProjection} from '../cataclysm-priest/types.js';
import type {CataclysmPriestRoundOutcome} from '../cataclysm-priest/combat.js';
import type {projectProphetCombat} from '../prophet/combat.js';
import type {ProphetState,ProphetCommand,ProphetProjection} from '../prophet/types.js';
import type {ProphetRoundOutcome} from '../prophet/combat.js';
import type {NightwatcherState,NightwatcherCommand,NightwatcherProjection} from '../nightwatcher/types.js';
import type {NightwatcherRoundOutcome} from '../nightwatcher/combat.js';
import type {projectNightwatcherCombat} from '../nightwatcher/combat.js';
import type {projectWitchKingCombat} from '../witch-king/combat.js';
import type {WitchKingRoundOutcome} from '../witch-king/combat.js';
import type {WitchKingState,WitchKingCommand,WitchKingProjection} from '../witch-king/types.js';
import type {AlchemistRoundOutcome} from '../alchemist/combat.js';
import type {AlchemistState,AlchemistCommand,AlchemistProjection} from '../alchemist/types.js';
import type {ManipulatorRoundOutcome} from '../manipulator/combat.js';
import type {ManipulatorState,ManipulatorCommand,ManipulatorProjection} from '../manipulator/types.js';
import type {IronBloodRoundOutcome} from '../iron-blood-knight/combat.js';
import type {IronBloodKnightState,IronBloodKnightCommand,IronBloodKnightProjection} from '../iron-blood-knight/types.js';
import type {BizarroSorcererState,BizarroSorcererCommand,BizarroSorcererProjection} from '../bizarro-sorcerer/types.js';
import type {DruidState,DruidCommand,DruidProjection} from '../druid/types.js';
import type {PunishmentKnightState,PunishmentKnightCommand,PunishmentKnightProjection} from '../punishment-knight/types.js';
import type {MentorDisorderState,MentorDisorderCommand,MentorDisorderProjection} from '../mentor-disorder/types.js';
import type {WinnerState,WinnerCommand,WinnerProjection} from '../winner/types.js';
import type {WraithState,WraithCommand,WraithProjection} from '../wraith/types.js';
import type {DesireApostleState,DesireApostleCommand,DesireApostleProjection} from '../desire-apostle/types.js';
import type {ShepherdState,ShepherdCommand,ShepherdProjection} from '../shepherd/types.js';
import type {StarMysticState,StarMysticCommand,StarMysticProjection} from '../star-mystic/types.js';
import type {PainState,PainCommand,PainProjection} from '../pain/types.js';
import type {GuardianState,GuardianCommand,GuardianProjection} from '../guardian/types.js';
import type {DreamStealerState,DreamStealerCommand,DreamStealerProjection} from '../dream-stealer/types.js';
import type {TravelerState,TravelerCommand,TravelerProjection} from '../traveler/types.js';
import type {GatekeeperState,GatekeeperCommand,GatekeeperProjection} from '../gatekeeper/types.js';
import type {PriestOfLightState,PriestOfLightCommand,PriestOfLightProjection} from '../priest-of-light/types.js';
import type {OceanSingerState,OceanSingerCommand,OceanSingerProjection} from '../ocean-singer/types.js';
import type {MysticismMagisterState,MysticismMagisterCommand,MysticismMagisterProjection} from '../mysticism-magister/types.js';
import type {SpiritWarlockState,SpiritWarlockCommand,SpiritWarlockProjection} from '../spirit-warlock/types.js';
import type {CrimsonScholarState,CrimsonScholarCommand,CrimsonScholarProjection} from '../crimson-scholar/types.js';
import type {AstronomerState,AstronomerCommand,AstronomerProjection} from '../astronomer/types.js';
import type {DreamwalkerState,DreamwalkerCommand,DreamwalkerProjection} from '../dreamwalker/types.js';
import type {ReaperState,ReaperCommand,ReaperProjection} from '../reaper/types.js';
import type {MarionettistState,MarionettistCommand,MarionettistProjection} from '../marionettist/types.js';
import type {BiologistState,BiologistCommand,BiologistProjection} from '../biologist/types.js';
import type {JudgeState,JudgeCommand,JudgeProjection} from '../judge/types.js';
import type {CorruptionBaronState,CorruptionBaronCommand,CorruptionBaronProjection} from '../corruption-baron/types.js';
import type {CalamityPriestState,CalamityPriestCommand,CalamityPriestProjection} from '../calamity-priest/types.js';
import type {ZombieState,ZombieCommand,ZombieProjection} from '../zombie/types.js';
import type {DemonState,DemonCommand,DemonProjection} from '../demon/types.js';
import type {RoseBishopState,RoseBishopCommand,RoseBishopProjection} from '../rose-bishop/types.js';
import type {ScrollProfessorState,ScrollProfessorCommand,ScrollProfessorProjection} from '../scroll-professor/types.js';
import type {PleasureState,PleasureCommand,PleasureProjection} from '../pleasure/types.js';
import type {DawnPaladinState,DawnPaladinCommand,DawnPaladinProjection} from '../dawn-paladin/types.js';
import type {FireThiefState,FireThiefCommand,FireThiefProjection} from '../fire-thief/types.js';
import type {RecorderState,RecorderCommand,RecorderProjection} from '../recorder/types.js';
import type {SpiritGuideState,SpiritGuideCommand,SpiritGuideProjection} from '../spirit-guide/types.js';
import type {NotaryState,NotaryCommand,NotaryProjection} from '../notary/types.js';
import type {WindBlessedState,WindBlessedCommand,WindBlessedProjection} from '../wind-blessed/types.js';
import type {PolymathState,PolymathCommand,PolymathProjection} from '../polymath/types.js';
import type {SootherState,SootherCommand,SootherProjection} from '../soother/types.js';
import type {PotionProfessorState,PotionProfessorCommand,PotionProfessorProjection} from '../potion-professor/types.js';
import type {ArtisanState,ArtisanCommand,ArtisanProjection} from '../artisan/types.js';
import type {HypnotistState,HypnotistCommand,HypnotistProjection} from '../hypnotist/types.js';
import type {ConspiratorState,ConspiratorCommand,ConspiratorProjection} from '../conspirator/types.js';
import type {FacelessState,FacelessCommand,FacelessProjection} from '../faceless/types.js';
import type {HarvestpriestState,HarvestpriestCommand,HarvestpriestProjection} from '../harvestpriest/types.js';
import type {PhysicianState,PhysicianCommand,PhysicianProjection} from '../physician/types.js';
import type {CultivatorState,CultivatorCommand,CultivatorProjection} from '../cultivator/types.js';
import type {InterrogatorState,InterrogatorCommand,InterrogatorProjection} from '../interrogator/types.js';
import type {SheriffState,SheriffCommand,SheriffProjection} from '../sheriff/types.js';
import type {ArbiterState,ArbiterCommand,ArbiterProjection} from '../arbiter/types.js';
import type {BriberState,BriberCommand,BriberProjection} from '../briber/types.js';
import type {BarbarianState,BarbarianCommand,BarbarianProjection} from '../barbarian/types.js';
import type {LawyerState,LawyerCommand,LawyerProjection} from '../lawyer/types.js';
import type {LuckyState,LuckyCommand,LuckyProjection} from '../lucky/types.js';
import type {MachineState,MachineCommand,MachineProjection} from '../machine/types.js';
import type {MonsterState,MonsterCommand,MonsterProjection} from '../monster/types.js';
import type {WerewolfState,WerewolfCommand,WerewolfProjection} from '../werewolf/types.js';
import type {MadmanState,MadmanCommand,MadmanProjection} from '../madman/types.js';
import type {PrisonerState,PrisonerCommand,PrisonerProjection} from '../prisoner/types.js';
import type {SerialKillerState,SerialKillerCommand,SerialKillerProjection} from '../serial-killer/types.js';
import type {UnwingedState,UnwingedCommand,UnwingedProjection} from '../unwinged/types.js';
import type {CriminalState,CriminalCommand,CriminalProjection} from '../criminal/types.js';
import type {ShadowAsceticState,ShadowAsceticCommand,ShadowAsceticProjection} from '../shadow-ascetic/types.js';
import type {ListenerState,ListenerCommand,ListenerProjection} from '../listener/types.js';
import type {SecretSupplicantState,SecretSupplicantCommand,SecretSupplicantProjection} from '../secret-supplicant/types.js';
import type {WizardState,WizardCommand,WizardProjection} from '../wizard/types.js';
import type {CombatScholarState,CombatScholarCommand,CombatScholarProjection} from '../combat-scholar/types.js';
import type {PryerState,PryerCommand,PryerProjection} from '../pryer/types.js';
import type {WitchState,WitchCommand,WitchProjection} from '../witch/types.js';
import type {InstigatorState,InstigatorCommand,InstigatorProjection} from '../instigator/types.js';
import type {AssassinState,AssassinCommand,AssassinProjection} from '../assassin/types.js';
import type {WeaponmasterState,WeaponmasterCommand,WeaponmasterProjection} from '../weaponmaster/types.js';
import type {GladiatorState,GladiatorCommand,GladiatorProjection} from '../gladiator/types.js';
import type {WarriorState,WarriorCommand,WarriorProjection} from '../warrior/types.js';
import type {CryptologistState,CryptologistCommand,CryptologistProjection} from '../cryptologist/types.js';
import type {SwindlerState,SwindlerCommand,SwindlerProjection} from '../swindler/types.js';
import type {MarauderState,MarauderCommand,MarauderProjection} from '../marauder/types.js';
import type {AstrologerState,AstrologerCommand,AstrologerProjection} from '../astrologer/types.js';
import type {TrickmasterState,TrickmasterCommand,TrickmasterProjection} from '../trickmaster/types.js';
import type {ApprenticeState,ApprenticeCommand,ApprenticeProjection} from '../apprentice/types.js';
import type {SpiritmediumState,SpiritmediumCommand,SpiritmediumProjection} from '../spiritmedium/types.js';
import type {GravediggerState,GravediggerCommand,GravediggerProjection} from '../gravedigger/types.js';
import type {CorpsecollectorState,CorpsecollectorCommand,CorpsecollectorProjection} from '../corpsecollector/types.js';
import type {SunpriestState,SunpriestCommand,SunpriestProjection} from '../sunpriest/types.js';
import type {LightprayerState,LightprayerCommand,LightprayerProjection} from '../lightprayer/types.js';
import type {BardState,BardCommand,BardProjection} from '../bard/types.js';
import type {NavigatorState,NavigatorCommand,NavigatorProjection} from '../navigator/types.js';
import type {RagerState,RagerCommand,RagerProjection} from '../rager/types.js';
import type {SailorState,SailorCommand,SailorProjection} from '../sailor/types.js';
import type {DetectiveState,DetectiveCommand,DetectiveProjection} from '../detective/types.js';
import type {ReasonerState,ReasonerCommand,ReasonerProjection} from '../reasoner/types.js';
import type {ReaderState,ReaderCommand,ReaderProjection} from '../reader/types.js';
import type {NightmareState,NightmareCommand,NightmareProjection} from '../nightmare/types.js';
import type {MidnightState,MidnightCommand,MidnightProjection} from '../midnight/types.js';
import type {SleeplessState,SleeplessCommand,SleeplessProjection} from '../sleepless/types.js';
import type {VampireState,VampireCommand,VampireProjection} from '../vampire/types.js';
import type {AppraiserState,AppraiserCommand,AppraiserProjection} from '../appraiser/types.js';
import type {PsychologistState,PsychologistCommand,PsychologistProjection} from '../psychologist/types.js';
import type {PyromaniacState,PyromaniacCommand,PyromaniacProjection} from '../pyromaniac/types.js';
import type {MagicianState,MagicianCommand,MagicianProjection} from '../magician/types.js';
import type {TamerState,TamerCommand,TamerProjection} from '../tamer/types.js';
import type {ApothecaryState,ApothecaryCommand,ApothecaryProjection} from '../apothecary/types.js';
import type {ArchaeologistState,ArchaeologistCommand,ArchaeologistProjection} from '../archaeologist/types.js';
import type {SavantState,SavantCommand,SavantProjection} from '../savant/types.js';
import type {TownState,TownCommand,TownProjection} from '../town/types.js';
import type {MindreaderState,MindreaderCommand,MindreaderProjection} from '../mindreader/types.js';
import type {AudienceState,AudienceCommand,AudienceProjection} from '../audience/types.js';
import type {ProvokerState,ProvokerCommand,ProvokerProjection} from '../provoker/types.js';
import type {HunterState,HunterCommand,HunterProjection} from '../hunter/types.js';
import type {ClownState,ClownCommand,ClownProjection} from '../clown/types.js';
import type {ProgressionState,SeerState,SeerCommand,SeerProjection} from '../seer/types.js';
import type { PublicCheckResult, PublicCoreStatKey, PublicGameDate } from '../../shared/contracts.js';

export type SliceLifeTier = 'DESTITUTE' | 'POOR' | 'ORDINARY' | 'RESPECTABLE' | 'LUXURIOUS';
export type SliceStance = 'ATTACK' | 'DEFEND' | 'CONTROL' | 'PREPARE' | 'RETREAT';
export type SliceIntent =
  | { type: 'ACTION'; action: 'WORK' | 'REST' }
  | { type: 'ACTION'; action: 'LEARN' | 'INVESTIGATE'; targetId: string }
  | { type: 'EVENT_CHOICE'; eventInstanceId: string; choiceId: string }
  | { type: 'COMBAT_ROUND'; stance: SliceStance; ragePolicy?: 'HOLD' | 'RELEASE_FIRST'; madmanPolicy?: 'HOLD' | 'BURST_FIRST'; recordingId?: string | null; shepherdSpiritId?: string | null; winnerPolicy?: 'HOLD' | 'SPEND_FIRST'; ironBloodPolicy?: 'HOLD' | 'SHARE_FIRST'; puppetCurse?:boolean; warBishopPolicy?:'HOLD'|'LINK_IF_READY' }
  | { type: 'REPAY'; amount: number }
  | { type: 'SET_LIFESTYLE'; tier: SliceLifeTier }
  | { type: 'CANCEL_AID' }
  | { type: 'CONTINUE_LIFE' }
  | { type: 'SEER'; command: SeerCommand }
  | { type: 'CLOWN'; command: ClownCommand }
  | { type: 'HUNTER'; command: HunterCommand }
  | { type:'FERRYMAN'; command:FerrymanCommand }
  | { type:'ELDER'; command:ElderCommand }
  | { type:'SAGE'; command:SageCommand }
  | { type:'CALAMITY_DEMONESS'; command:CalamityDemonessCommand }
  | { type:'GLORY'; command:GloryCommand }
  | { type:'FATE_TROJAN'; command:FateTrojanCommand }
  | { type:'PLANESWALKER'; command:PlaneswalkerCommand }
  | { type:'DEATH_CONSUL'; command:DeathConsulCommand }
  | { type:'LIGHT_SEEKER'; command:LightSeekerCommand }
  | { type:'CATASTROPHE'; command:CatastropheCommand }
  | { type:'WISDOM_ANGEL'; command:WisdomAngelCommand }
  | { type:'CONCEALMENT_SERVANT'; command:ConcealmentServantCommand }
  | { type:'LIFE_GIVER'; command:LifeGiverCommand }
  | { type:'KNOWLEDGE_MENTOR'; command:KnowledgeMentorCommand }
  | { type:'DISCERNER'; command:DiscernerCommand }
  | { type:'WEATHER_WARLOCK'; command:WeatherWarlockCommand }
  | { type:'MIRACLE_WORKER'; command:MiracleWorkerCommand }
  | { type:'COFFIN_BEARER'; command:CoffinBearerCommand }
  | { type:'CHAOS_HUNTER'; command:ChaosHunterCommand }
  | { type:'FRENZY_MAGE'; command:FrenzyMageCommand }
  | { type:'CHAOS_WALKER'; command:ChaosWalkerCommand }
  | { type:'SILENT_DISCIPLE'; command:SilentDiscipleCommand }
  | { type:'BLATHERER'; command:BlathererCommand }
  | { type:'THREE_HEADED_TEMPLAR'; command:ThreeHeadedTemplarCommand }
  | { type:'PROPHECY_MASTER'; command:ProphecyMasterCommand }
  | { type:'UNAGING_DEMONESS'; command:UnagingDemonessCommand }
  | { type:'SILVER_KNIGHT'; command:SilverKnightCommand }
  | { type:'DECEIT_MENTOR'; command:DeceitMentorCommand }
  | { type:'WANDERER'; command:WandererCommand }
  | { type:'JUSTICE_MENTOR'; command:JusticeMentorCommand }
  | { type:'SEA_KING'; command:SeaKingCommand }
  | { type:'INSIGHT_SCHOLAR'; command:InsightScholarCommand }
  | { type:'FEAR_BISHOP'; command:FearBishopCommand }
  | { type:'SUMMONING_MASTER'; command:SummoningMasterCommand }
  | { type:'ARCANE_SCHOLAR'; command:ArcaneScholarCommand }
  | { type:'DREAM_WEAVER'; command:DreamWeaverCommand }
  | { type:'WAR_BISHOP'; command:WarBishopCommand }
  | { type:'ANCIENT_SCHOLAR'; command:AncientScholarCommand }
  | { type:'LONG_CHAPTER'; command:LongChapterCommand }
  | { type:'ANCIENT_ALCHEMIST'; command:AncientAlchemistCommand }
  | { type:'IMPERATIVE_MAGE'; command:ImperativeMageCommand }
  | { type:'FALLEN_EARL'; command:FallenEarlCommand }
  | { type:'MISFORTUNE_MAGE'; command:MisfortuneMageCommand }
  | { type:'PUPPET'; command:PuppetCommand }
  | { type:'DEVIL'; command:DevilCommand }
  | { type:'BLACK_KNIGHT'; command:BlackKnightCommand }
  | { type:'MYSTIC'; command:MysticCommand }
  | { type:'DESPAIR'; command:DespairCommand }
  | { type:'DEMON_HUNTER'; command:DemonHunterCommand }
  | { type:'PARASITE'; command:ParasiteCommand }
  | { type:'SECRETS_SORCERER'; command:SecretsSorcererCommand }
  | { type:'UNDYING'; command:UndyingCommand }
  | { type:'UNSHADOWED'; command:UnshadowedCommand }
  | { type:'CATACLYSM_PRIEST'; command:CataclysmPriestCommand }
  | { type:'PROPHET'; command:ProphetCommand }
  | { type:'NIGHTWATCHER'; command:NightwatcherCommand }
  | { type:'WITCH_KING'; command:WitchKingCommand }
  | { type:'ALCHEMIST'; command:AlchemistCommand }
  | { type:'MANIPULATOR'; command:ManipulatorCommand }
  | { type:'IRON_BLOOD_KNIGHT'; command:IronBloodKnightCommand }
  | { type:'BIZARRO_SORCERER'; command:BizarroSorcererCommand }
  | { type:'DRUID'; command:DruidCommand }
  | { type:'PUNISHMENT_KNIGHT'; command:PunishmentKnightCommand }
  | { type:'MENTOR_DISORDER'; command:MentorDisorderCommand }
  | { type:'WINNER'; command:WinnerCommand }
  | { type:'WRAITH'; command:WraithCommand }
  | { type:'DESIRE_APOSTLE'; command:DesireApostleCommand }
  | { type:'SHEPHERD'; command:ShepherdCommand }
  | { type:'STAR_MYSTIC'; command:StarMysticCommand }
  | { type:'PAIN'; command:PainCommand }
  | { type:'GUARDIAN'; command:GuardianCommand }
  | { type:'DREAM_STEALER'; command:DreamStealerCommand }
  | { type:'TRAVELER'; command:TravelerCommand }
  | { type:'GATEKEEPER'; command:GatekeeperCommand }
  | { type:'PRIEST_OF_LIGHT'; command:PriestOfLightCommand }
  | { type:'OCEAN_SINGER'; command:OceanSingerCommand }
  | { type:'MYSTICISM_MAGISTER'; command:MysticismMagisterCommand }
  | { type:'SPIRIT_WARLOCK'; command:SpiritWarlockCommand }
  | { type:'CRIMSON_SCHOLAR'; command:CrimsonScholarCommand }
  | { type:'ASTRONOMER'; command:AstronomerCommand }
  | { type:'DREAMWALKER'; command:DreamwalkerCommand }
  | { type:'REAPER'; command:ReaperCommand }
  | { type:'MARIONETTIST'; command:MarionettistCommand }
  | { type:'BIOLOGIST'; command:BiologistCommand }
  | { type:'JUDGE'; command:JudgeCommand }
  | { type:'CORRUPTION_BARON'; command:CorruptionBaronCommand }
  | { type:'CALAMITY_PRIEST'; command:CalamityPriestCommand }
  | { type:'ZOMBIE'; command:ZombieCommand }
  | { type:'DEMON'; command:DemonCommand }
  | { type:'ROSE_BISHOP'; command:RoseBishopCommand }
  | { type:'SCROLL_PROFESSOR'; command:ScrollProfessorCommand }
  | { type:'PLEASURE'; command:PleasureCommand }
  | { type:'DAWN_PALADIN'; command:DawnPaladinCommand }
  | { type:'FIRE_THIEF'; command:FireThiefCommand }
  | { type:'RECORDER'; command:RecorderCommand }
  | { type:'SPIRIT_GUIDE'; command:SpiritGuideCommand }
  | { type:'NOTARY'; command:NotaryCommand }
  | { type:'WIND_BLESSED'; command:WindBlessedCommand }
  | { type:'POLYMATH'; command:PolymathCommand }
  | { type:'SOOTHER'; command:SootherCommand }
  | { type:'POTION_PROFESSOR'; command:PotionProfessorCommand }
  | { type:'ARTISAN'; command:ArtisanCommand }
  | { type:'HYPNOTIST'; command:HypnotistCommand }
  | { type:'CONSPIRATOR'; command:ConspiratorCommand }
  | { type:'FACELESS'; command:FacelessCommand }
  | { type:'HARVESTPRIEST'; command:HarvestpriestCommand }
  | { type:'PHYSICIAN'; command:PhysicianCommand }
  | { type:'CULTIVATOR'; command:CultivatorCommand }
  | { type:'INTERROGATOR'; command:InterrogatorCommand }
  | { type:'SHERIFF'; command:SheriffCommand }
  | { type:'ARBITER'; command:ArbiterCommand }
  | { type:'BRIBER'; command:BriberCommand }
  | { type:'BARBARIAN'; command:BarbarianCommand }
  | { type:'LAWYER'; command:LawyerCommand }
  | { type:'LUCKY'; command:LuckyCommand }
  | { type:'MACHINE'; command:MachineCommand }
  | { type:'MONSTER'; command:MonsterCommand }
  | { type:'WEREWOLF'; command:WerewolfCommand }
  | { type:'MADMAN'; command:MadmanCommand }
  | { type:'PRISONER'; command:PrisonerCommand }
  | { type:'SERIAL_KILLER'; command:SerialKillerCommand }
  | { type:'UNWINGED'; command:UnwingedCommand }
  | { type:'CRIMINAL'; command:CriminalCommand }
  | { type:'SHADOW_ASCETIC'; command:ShadowAsceticCommand }
  | { type:'LISTENER'; command:ListenerCommand }
  | { type:'SECRET_SUPPLICANT'; command:SecretSupplicantCommand }
  | { type:'WIZARD'; command:WizardCommand }
  | { type:'COMBAT_SCHOLAR'; command:CombatScholarCommand }
  | { type:'PRYER'; command:PryerCommand }
  | { type:'WITCH'; command:WitchCommand }
  | { type:'INSTIGATOR'; command:InstigatorCommand }
  | { type:'ASSASSIN'; command:AssassinCommand }
  | { type:'WEAPONMASTER'; command:WeaponmasterCommand }
  | { type:'GLADIATOR'; command:GladiatorCommand }
  | { type:'WARRIOR'; command:WarriorCommand }
  | { type:'CRYPTOLOGIST'; command:CryptologistCommand }
  | { type:'SWINDLER'; command:SwindlerCommand }
  | { type:'MARAUDER'; command:MarauderCommand }
  | { type:'ASTROLOGER'; command:AstrologerCommand }
  | { type:'TRICKMASTER'; command:TrickmasterCommand }
  | { type:'APPRENTICE'; command:ApprenticeCommand }
  | { type:'SPIRITMEDIUM'; command:SpiritmediumCommand }
  | { type:'GRAVEDIGGER'; command:GravediggerCommand }
  | { type:'CORPSECOLLECTOR'; command:CorpsecollectorCommand }
  | { type:'SUNPRIEST'; command:SunpriestCommand }
  | { type:'LIGHTPRAYER'; command:LightprayerCommand }
  | { type:'BARD'; command:BardCommand }
  | { type:'NAVIGATOR'; command:NavigatorCommand }
  | { type:'RAGER'; command:RagerCommand }
  | { type:'SAILOR'; command:SailorCommand }
  | { type:'DETECTIVE'; command:DetectiveCommand }
  | { type:'REASONER'; command:ReasonerCommand }
  | { type:'READER'; command:ReaderCommand }
  | { type:'NIGHTMARE'; command:NightmareCommand }
  | { type:'MIDNIGHT'; command:MidnightCommand }
  | { type:'SLEEPLESS'; command:SleeplessCommand }
  | { type:'VAMPIRE'; command:VampireCommand }
  | { type:'APPRAISER'; command:AppraiserCommand }
  | { type:'PSYCHOLOGIST'; command:PsychologistCommand }
  | { type: 'PYROMANIAC'; command:PyromaniacCommand }
  | { type: 'MAGICIAN'; command:MagicianCommand }
  | { type: 'TAMER'; command:TamerCommand }
  | { type: 'APOTHECARY'; command:ApothecaryCommand }
  | { type: 'ARCHAEOLOGIST'; command:ArchaeologistCommand }
  | { type: 'SAVANT'; command:SavantCommand }
  | { type: 'TOWN'; command: TownCommand }
  | { type: 'MINDREADER'; command: MindreaderCommand }
  | { type: 'AUDIENCE'; command: AudienceCommand }
  | { type: 'PROVOKER'; command: ProvokerCommand };
export interface SliceCharacter {
  name: string; portraitId: string; originId: string; originName: string; professionId: string; professionName: string;
  age: number; gender: string; education: string; learningBonus: number; weeklyWage: number;
  coreStats: Record<PublicCoreStatKey, number>;
  birthplace: {id:string;label:string}; appearanceDescription:string; traits:{id:string;label:string}[]; flaw:{id:string;label:string};
  acceptedConditionIds:string[]; creationCosts:{professionInitialPence:number;familyTransferPence:number;conditionCostPence:number;educationCostPence:number};
}
export interface SliceInjury { id: string; severity: 'LIGHT' | 'HEAVY'; acquiredRevision: number; treatedRevision: number | null }
export interface SliceDebt { id: string; source: string; remaining: number; weeklyPayment: number; createdWeek: number }
export interface SliceRecord { id: string; week: number; title: string; text: string }
export interface SliceTarget { id: string; label: string; description: string }
export interface SliceChoice { id: string; label: string; preview: string; enabled: boolean; disabledReason?: string }
export interface SliceEvent {
  instanceId: string; id: string; title: string; body: string; facts: string[]; choices: SliceChoice[]; actor?:'MAEVE'|'INTERMEDIARY';
}
export interface SliceEnding {
  kind: 'COMPLETED' | 'ABANDONED' | 'DEATH'; title: string; summary: string;
  workers: string; accountability: string; hazard: string; relationship: string;
}
export interface SliceWheelEntry { id: string; label: string; weight: number }
export interface SliceCombatMove { actor: 'PLAYER' | 'ENEMY'; label: string; selfGain: number; enemyReduction: number }
export interface SliceCombatRound {
  coffinBearerOutcome?:CoffinBearerRoundOutcome;
  chaosHunterOutcome?:ChaosHunterRoundOutcome;
  frenzyMageOutcome?:FrenzyMageRoundOutcome;
  chaosWalkerOutcome?:ChaosWalkerRoundOutcome;
  silentDiscipleOutcome?:SilentDiscipleRoundOutcome;
  blathererOutcome?:BlathererRoundOutcome;
  threeHeadedTemplarOutcome?:ThreeHeadedTemplarRoundOutcome;
  prophecyMasterOutcome?:ProphecyMasterRoundOutcome;
  unagingDemonessOutcome?:UnagingDemonessRoundOutcome;
  silverKnightOutcome?:SilverKnightRoundOutcome;
  deceitMentorOutcome?:DeceitMentorRoundOutcome;
  wandererOutcome?:WandererRoundOutcome;
  ferrymanOutcome?:FerrymanRoundOutcome;
  justiceMentorOutcome?:JusticeMentorRoundOutcome;
  seaKingOutcome?:SeaKingRoundOutcome;
  insightScholarOutcome?:InsightScholarRoundOutcome;
  fearBishopOutcome?:FearBishopRoundOutcome;
  summoningMasterOutcome?:SummoningMasterRoundOutcome;
  arcaneScholarOutcome?:ArcaneScholarRoundOutcome;
  dreamWeaverOutcome?:DreamWeaverRoundOutcome;
  warBishopOutcome?:WarBishopRoundOutcome;
  elderOutcome?:ElderRoundOutcome;
  sageOutcome?:SageRoundOutcome;
  calamityDemonessOutcome?:CalamityDemonessRoundOutcome;
  gloryOutcome?:GloryRoundOutcome;
  fateTrojanOutcome?:FateTrojanRoundOutcome;
  planeswalkerOutcome?:PlaneswalkerRoundOutcome;
  deathConsulOutcome?:DeathConsulRoundOutcome;
  lightSeekerOutcome?:LightSeekerRoundOutcome;
  catastropheOutcome?:CatastropheRoundOutcome;
  wisdomAngelOutcome?:WisdomAngelRoundOutcome;
  concealmentServantOutcome?:ConcealmentServantRoundOutcome;
  lifeGiverOutcome?:LifeGiverRoundOutcome;
  knowledgeMentorOutcome?:KnowledgeMentorRoundOutcome;
  discernerOutcome?:DiscernerRoundOutcome;
  weatherWarlockOutcome?:WeatherWarlockRoundOutcome;
  miracleWorkerOutcome?:MiracleWorkerRoundOutcome;
  ancientScholarOutcome?:AncientScholarRoundOutcome;
  ancientAlchemistOutcome?:AncientAlchemistRoundOutcome;
  imperativeMageOutcome?:ImperativeMageRoundOutcome;
  fallenEarlOutcome?:FallenEarlRoundOutcome;
  misfortuneMageOutcome?:MisfortuneMageRoundOutcome;
  puppetOutcome?:PuppetRoundOutcome;
  devilOutcome?:DevilRoundOutcome;
  blackKnightOutcome?:BlackKnightRoundOutcome;
  mysticOutcome?:MysticRoundOutcome;
  despairOutcome?:DespairRoundOutcome;
  demonHunterOutcome?:DemonHunterRoundOutcome;
  parasiteOutcome?:ParasiteRoundOutcome;
  secretsSorcererOutcome?:SecretsSorcererRoundOutcome;
  undyingOutcome?:UndyingRoundOutcome;
  unshadowedOutcome?:UnshadowedRoundOutcome;
  cataclysmPriestOutcome?:CataclysmPriestRoundOutcome;
  prophetOutcome?:ProphetRoundOutcome;
  nightwatcherOutcome?:NightwatcherRoundOutcome;
  witchKingOutcome?:WitchKingRoundOutcome;
  alchemistOutcome?:AlchemistRoundOutcome;
  manipulatorOutcome?:ManipulatorRoundOutcome;
  ironBloodOutcome?:IronBloodRoundOutcome;
  bizarroOutcome?:{targetId:string;attemptId:string;enemyHealth:number;enemyMind:number;enemySpirituality:number;enemyStatus:'RESISTING'|'DEAD';playerAttackCount:number;deathWitnessIds:string[];viewObstructed:boolean;unsafe:boolean};
  painOutcome?: {enemyHealth:number;enemyStatus:'RESISTING'|'SURRENDERED'|'DEAD';enemyDisease:number;diseaseApplications:number};
  passiveLuck?: {roll:number;triggered:boolean;bonus:number};
  madmanBurst?: {policy:'HOLD'|'BURST_FIRST';triggered:boolean;mentalCost:number;spiritualCost:number};
  /** Present on new typed physical rounds; absent legacy records retain their original shape. */
  consequenceDomain?:'BODY'|'MENTAL';
  consequenceRoll?:number; pendingConsequence?:'LIGHT'|'HEAVY'|'DEATH';
  round: number; stance: SliceStance; first: 'PLAYER' | 'ENEMY'; playerCount: number; enemyCount: number;
  playerCountRoll: number; enemyCountRoll: number; moves: SliceCombatMove[];
  playerAdvantage: number; enemyAdvantage: number; winChance: number; winner: 'PLAYER' | 'ENEMY' | null;
  consequence: string; consequenceWeights: { light: number; heavy: number; death: number } | null;
  retreat: 'NONE' | 'SUCCESS' | 'FAILURE';
}
export interface SliceCombatState {
  weaponmasterWeakPoint?: {observed:boolean;prepared:boolean};
  swindlerDeceit?: {observed:boolean;prepared:boolean;skipNext:boolean};
  reasonerInterference?: boolean;
  sailorScalesReady?: boolean;
  wrathCharge?: number;
  navigatorWater?: {soakedRemaining:0|1|2;bound:boolean;skipNext:boolean};
  encounterId:'FIRST_CASE'|'ELDER_DISPUTE'|'SAGE_DISPUTE'|'CALAMITY_DEMONESS_DISPUTE'|'GLORY_DISPUTE'|'FATE_TROJAN_DISPUTE'|'PLANESWALKER_DISPUTE'|'DEATH_CONSUL_DISPUTE'|'LIGHT_SEEKER_DISPUTE'|'CATASTROPHE_DISPUTE'|'WISDOM_ANGEL_DISPUTE'|'CONCEALMENT_SERVANT_DISPUTE'|'LIFE_GIVER_DISPUTE'|'KNOWLEDGE_MENTOR_DISPUTE'|'DISCERNER_DISPUTE'|'WEATHER_WARLOCK_DISPUTE'|'MIRACLE_WORKER_DISPUTE'|'COFFIN_BEARER_DISPUTE'|'CHAOS_HUNTER_DISPUTE'|'FRENZY_MAGE_DISPUTE'|'CHAOS_WALKER_DISPUTE'|'SILENT_DISCIPLE_DISPUTE'|'BLATHERER_COURT'|'THREE_HEADED_TEMPLAR_DISPUTE'|'PROPHECY_MASTER_DISPUTE'|'UNAGING_DEMONESS_DISPUTE'|'SILVER_KNIGHT_HUNT'|'SILVER_KNIGHT_DISPUTE'|'DECEIT_MENTOR_DISPUTE'|'WANDERER_DISPUTE'|'FERRYMAN_DISPUTE'|'JUSTICE_MENTOR_DISPUTE'|'SEA_KING_DISPUTE'|'INSIGHT_SCHOLAR_DISPUTE'|'FEAR_BISHOP_DISPUTE'|'SUMMONING_MASTER_DISPUTE'|'ARCANE_SCHOLAR_DISPUTE'|'DREAM_WEAVER_DISPUTE'|'WAR_BISHOP_DISPUTE'|'ANCIENT_SCHOLAR_DISPUTE'|'ANCIENT_ALCHEMIST_DISPUTE'|'IMPERATIVE_MAGE_DISPUTE'|'FALLEN_EARL_DISPUTE'|'MISFORTUNE_MAGE_DISPUTE'|'PUPPET_DISPUTE'|'DEVIL_DISPUTE'|'BLACK_KNIGHT_DISPUTE'|'MYSTIC_DISPUTE'|'DESPAIR_DISPUTE'|'DEMON_HUNTER_DISPUTE'|'PARASITE_DISPUTE'|'SECRETS_SORCERER_RITUAL'|'UNDYING_DISPUTE'|'UNSHADOWED_DISPUTE'|'CATACLYSM_PRIEST_DISPUTE'|'PROPHET_DISPUTE'|'NIGHTWATCHER_DISPUTE'|'WITCH_KING_DISPUTE'|'ALCHEMIST_DISPUTE'|'MANIPULATOR_DISPUTE'|'IRON_BLOOD_DISPUTE'|'BIZARRO_RITUAL'|'DRUID_DISPUTE'|'PUNISHMENT_KNIGHT_DISPUTE'|'MENTOR_DISORDER_DISPUTE'|'WINNER_DISPUTE'|'WRAITH_DISPUTE'|'DESIRE_APOSTLE_DISPUTE'|'SHEPHERD_DISPUTE'|'STAR_MYSTIC_DISPUTE'|'PAIN_DISPUTE'|'GUARDIAN_DISPUTE'|'DREAM_STEALER_DISPUTE'|'TRAVELER_DISPUTE'|'GATEKEEPER_DISPUTE'|'PRIEST_OF_LIGHT_DISPUTE'|'OCEAN_SINGER_DISPUTE'|'MYSTICISM_MAGISTER_DISPUTE'|'SPIRIT_WARLOCK_DISPUTE'|'CRIMSON_SCHOLAR_DISPUTE'|'ASTRONOMER_DISPUTE'|'DREAMWALKER_DISPUTE'|'REAPER_DISPUTE'|'MARIONETTIST_DISPUTE'|'BIOLOGIST_DISPUTE'|'JUDGE_DISPUTE'|'CORRUPTION_BARON_DISPUTE'|'CALAMITY_PRIEST_DISPUTE'|'ZOMBIE_DISPUTE'|'DEMON_DISPUTE'|'ROSE_BISHOP_DISPUTE'|'SCROLL_PROFESSOR_DISPUTE'|'PLEASURE_DISPUTE'|'DAWN_PALADIN_DISPUTE'|'FIRE_THIEF_DISPUTE'|'RECORDER_DISPUTE'|'SPIRIT_GUIDE_DISPUTE'|'NOTARY_DISPUTE'|'WIND_BLESSED_DISPUTE'|'POLYMATH_DISPUTE'|'SOOTHER_DISPUTE'|'POTION_PROFESSOR_DISPUTE'|'ARTISAN_DISPUTE'|'HYPNOTIST_DISPUTE'|'CONSPIRATOR_DISPUTE'|'FACELESS_DISPUTE'|'CLOWN_RESCUE'|'HUNTER_CARGO'|'PROVOKER_DISPUTE'|'MAGICIAN_DISPUTE'|'PYROMANIAC_DISPUTE'|'PSYCHOLOGIST_DISPUTE'|'VAMPIRE_DISPUTE'|'SLEEPLESS_WATCH'|'MIDNIGHT_DISPUTE'|'NIGHTMARE_DISPUTE'|'MARAUDER_DISPUTE';
  round: number; enemyHealth: number; enemyMind: number; enemyInjuries: SliceInjury[]; enemyRisk: number;
  enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; lastRound: SliceCombatRound | null;
}
export interface SliceCombatProjection {
  coffinBearer?:ReturnType<typeof projectCoffinBearerCombat>;
  chaosHunter?:ReturnType<typeof projectChaosHunterCombat>;
  frenzyMage?:ReturnType<typeof projectFrenzyMageCombat>;
  chaosWalker?:ReturnType<typeof projectChaosWalkerCombat>;
  silentDisciple?:ReturnType<typeof projectSilentDiscipleCombat>;
  blatherer?:ReturnType<typeof projectBlathererCombat>;
  threeHeadedTemplar?:ReturnType<typeof projectThreeHeadedTemplarCombat>;
  prophecyMaster?:ReturnType<typeof projectProphecyMasterCombat>;
  unagingDemoness?:ReturnType<typeof projectUnagingDemonessCombat>;
  silverKnight?:ReturnType<typeof projectSilverKnightCombat>;
  deceitMentor?:ReturnType<typeof projectDeceitMentorCombat>;
  wanderer?:ReturnType<typeof projectWandererCombat>;
  ferryman?:ReturnType<typeof projectFerrymanCombat>;
  justiceMentor?:ReturnType<typeof projectJusticeMentorCombat>;
  seaKing?:ReturnType<typeof projectSeaKingCombat>;
  insightScholar?:ReturnType<typeof projectInsightScholarCombat>;
  fearBishop?:ReturnType<typeof projectFearBishopCombat>;
  summoningMaster?:ReturnType<typeof projectSummoningMasterCombat>;
  arcaneScholar?:ReturnType<typeof projectArcaneScholarCombat>;
  dreamWeaver?:ReturnType<typeof projectDreamWeaverCombat>;
  warBishop?:ReturnType<typeof projectWarBishopCombat>;
  elder?:ElderCombatProjection;
  sage?:SageCombatProjection;
  calamityDemoness?:CalamityDemonessCombatProjection;
  glory?:GloryCombatProjection;
  fateTrojan?:ReturnType<typeof projectFateTrojanCombat>;
  planeswalker?:ReturnType<typeof projectPlaneswalkerCombat>;
  deathConsul?:ReturnType<typeof projectDeathConsulCombat>;
  lightSeeker?:ReturnType<typeof projectLightSeekerCombat>;
  catastrophe?:ReturnType<typeof projectCatastropheCombat>;
  wisdomAngel?:ReturnType<typeof projectWisdomAngelCombat>;
  concealmentServant?:ReturnType<typeof projectConcealmentServantCombat>;
  lifeGiver?:ReturnType<typeof projectLifeGiverCombat>;
  knowledgeMentor?:ReturnType<typeof projectKnowledgeMentorCombat>;
  discerner?:ReturnType<typeof projectDiscernerCombat>;
  weatherWarlock?:ReturnType<typeof projectWeatherWarlockCombat>;
  miracleWorker?:ReturnType<typeof projectMiracleWorkerCombat>;
  ancientScholar?:ReturnType<typeof projectAncientScholarCombat>;
  ancientAlchemist?:ReturnType<typeof projectAncientAlchemistCombat>;
  imperativeMage?:ReturnType<typeof projectImperativeMageCombat>;
  fallenEarl?:ReturnType<typeof projectFallenEarlCombat>;
  misfortuneMage?:ReturnType<typeof projectMisfortuneMageCombat>;
  puppet?:ReturnType<typeof projectPuppetCombat>;
  devil?:ReturnType<typeof projectDevilCombat>;
  blackKnight?:ReturnType<typeof projectBlackKnightCombat>;
  mystic?:ReturnType<typeof projectMysticCombat>;
  despair?:ReturnType<typeof projectDespairCombat>;
  demonHunter?:ReturnType<typeof projectDemonHunterCombat>;
  parasite?:ReturnType<typeof projectParasiteCombat>;
  secretsSorcerer?:ReturnType<typeof projectSecretsSorcererCombat>;
  undying?:ReturnType<typeof projectUndyingCombat>;
  unshadowed?:ReturnType<typeof projectUnshadowedCombat>;
  cataclysmPriest?:ReturnType<typeof projectCataclysmPriestCombat>;
  prophet?:ReturnType<typeof projectProphetCombat>;
  nightwatcher?:ReturnType<typeof projectNightwatcherCombat>;
  witchKing?:ReturnType<typeof projectWitchKingCombat>;
  alchemist?:{creationId:string|null;charge:number;durability:number;active:boolean;summary:string};
  manipulator?:{mentalPlague:number;mentalDefence:string;summary:string};
  ironBlood?:{enemyName:string;companions:Array<{id:string;name:string;health:number;energy:number;present:boolean}>;linkedMemberIds:string[];sharePolicy:"HOLD"|"SHARE_FIRST";summary:string};
  bizarro?: {enemyName:string;enemySpirituality:number;veil:boolean;witnessesPresent:number;invalidReason:string|null;originalBellId:string;mode:string};
  rage?: {charge:number};
  water?: {soakedRemaining:number;bound:boolean;skipNext:boolean};
  title?:string;
  round: number; enemyName: string; enemyHealth: number; enemyMind?:number; enemyStatus: string;
  playerCountWheel: SliceWheelEntry[]; enemyCountWheel: SliceWheelEntry[];
  playerAbilityWheel: SliceWheelEntry[]; enemyAbilityWheel: SliceWheelEntry[];
  playerAbilityWheels?: Partial<Record<SliceStance,SliceWheelEntry[]>>;
  consequenceWeights: { light: number; heavy: number; death: number };
  stances: { id: SliceStance; label: string; description: string }[];
  lastRound: SliceCombatRound | null;
}
export type WorkersOutcome = 'MOST_SAVED' | 'SOME_SAVED' | 'HEAVY_CASUALTIES';
export type AccountabilityOutcome = 'PUBLIC_CASE' | 'PARTIAL_EVIDENCE' | 'COVERED_UP';
export type HazardOutcome = 'CONTAINED_BY_NIGHTHAWKS' | 'SECURED_TEMPORARILY' | 'ESCAPED_WITH_CARRIER' | 'DESTROYED_VERIFIED' | 'LOCATION_UNCONFIRMED';
export type AudreyOutcome = 'TRUSTED_CONTACT' | 'CAUTIOUS_DISTANCE' | 'NO_RELATION';
/** Internal authoritative facts. This type must NEVER cross the renderer bridge. */
export interface SliceWorld {
  city: 'BACKLUND' | 'ELSEWHERE'; messageChannel: boolean;
  audrey: 'AVAILABLE' | 'UNAVAILABLE' | 'GONE'; intermediaryAvailable: boolean;
  maeveAvailable: boolean; manager: 'ACTIVE' | 'DEAD' | 'ARRESTED' | 'LEFT'; successorRegistered: boolean;
  organizationAvailable: boolean; organizationEligible: boolean; organizationArrived: boolean;
  bell: 'ACTIVE' | 'DESTROYED_VERIFIED' | 'TRANSFERRED' | 'CONTAINED' | 'SECURED';
  bellHolder: 'CARRIER' | 'PLAYER' | 'OTHER' | 'ORGANIZATION' | 'NONE'; bellAtScene: boolean;
  bellFactKnown: boolean; transferKnown: boolean; carrierAlive: boolean; carrierCanResist: boolean;
  destructionSource: string | null; responsibilityEvidence: boolean; recordsAvailable: boolean;
  careAvailable: boolean; aidBatchAvailable: boolean;
}
export interface SliceArc {
  stage: 'NOT_STARTED' | 'A' | 'WAIT_B' | 'B' | 'C_AVAILABLE' | 'C' | 'COMBAT' | 'ENDED';
  startWeek: number | null; completedAWeek: number | null; bPaid: boolean; managementAlert: number; immediateTransferPrevented:boolean;
  originalLedger: boolean; credibleWitness: boolean; fullCrossLedger: boolean; necessaryCrossLedger: boolean;
  reportWeek: number | null; credibleReport: boolean; crisis: boolean;
  workers: WorkersOutcome | null; accountability: AccountabilityOutcome | null; hazard: HazardOutcome | null;
  relationship: AudreyOutcome; transferPending: boolean;
}
export interface SliceState {
  elder:ElderState;
  sage:SageState;
  calamityDemoness:CalamityDemonessState;
  glory:GloryState;
  fateTrojan:FateTrojanState;
  planeswalker:PlaneswalkerState;
  deathConsul:DeathConsulState;
  lightSeeker:LightSeekerState;
  catastrophe:CatastropheState;
  wisdomAngel:WisdomAngelState;
  concealmentServant:ConcealmentServantState;
  lifeGiver:LifeGiverState;
  knowledgeMentor:KnowledgeMentorState;
  discerner:DiscernerState;
  weatherWarlock:WeatherWarlockState;
  miracleWorker:MiracleWorkerState;
  coffinBearer:CoffinBearerState;
  chaosHunter:ChaosHunterState;
  frenzyMage:FrenzyMageState;
  chaosWalker:ChaosWalkerState;
  silentDisciple:SilentDiscipleState;
  blatherer:BlathererState;
  threeHeadedTemplar:ThreeHeadedTemplarState;
  prophecyMaster:ProphecyMasterState;
  unagingDemoness:UnagingDemonessState;
  silverKnight:SilverKnightState;
  deceitMentor:DeceitMentorState;
  wanderer:WandererState;
  ferryman:FerrymanState;
  justiceMentor:JusticeMentorState;
  seaKing:SeaKingState;
  insightScholar:InsightScholarState;
  fearBishop:FearBishopState;
  summoningMaster:SummoningMasterState;
  arcaneScholar:ArcaneScholarState;
  dreamWeaver:DreamWeaverState;
  warBishop:WarBishopState;
  ancientScholar:AncientScholarState;
  longChapter:LongChapterState;
  ancientAlchemist:AncientAlchemistState;
  imperativeMage:ImperativeMageState;
  fallenEarl:FallenEarlState;
  misfortuneMage:MisfortuneMageState;
  puppet:PuppetState;
  devil:DevilState;
  blackKnight:BlackKnightState;
  mystic:MysticState;
  despair:DespairState;
  demonHunter:DemonHunterState;
  parasite:ParasiteState;
  secretsSorcerer:SecretsSorcererState;
  undying:UndyingState;
  unshadowed:UnshadowedState;
  cataclysmPriest:CataclysmPriestState;
  prophet:ProphetState;
  nightwatcher:NightwatcherState;
  witchKing:WitchKingState;
  alchemist:AlchemistState;
  manipulator:ManipulatorState;
  ironBloodKnight:IronBloodKnightState;
  bizarroSorcerer:BizarroSorcererState;
  druid:DruidState;
  punishmentKnight:PunishmentKnightState;
  mentorDisorder:MentorDisorderState;
  winner:WinnerState;
  wraith:WraithState;
  desireApostle:DesireApostleState;
  shepherd:ShepherdState;
  starMystic:StarMysticState;
  pain:PainState;
  guardian:GuardianState;
  dreamStealer:DreamStealerState;
  traveler:TravelerState;
  gatekeeper:GatekeeperState;
  priestOfLight:PriestOfLightState;
  oceanSinger:OceanSingerState;
  mysticismMagister:MysticismMagisterState;
  spiritWarlock:SpiritWarlockState;
  crimsonScholar:CrimsonScholarState;
  astronomer:AstronomerState;
  dreamwalker:DreamwalkerState;
  reaper:ReaperState;
  marionettist:MarionettistState;
  biologist:BiologistState;
  judge:JudgeState;
  corruptionBaron:CorruptionBaronState;
  calamityPriest:CalamityPriestState;
  zombie:ZombieState;
  demon:DemonState;
  roseBishop:RoseBishopState;
  scrollProfessor:ScrollProfessorState;
  pleasure:PleasureState;
  dawnPaladin:DawnPaladinState;
  fireThief:FireThiefState;
  recorder:RecorderState;
  spiritGuide:SpiritGuideState;
  notary:NotaryState;
  windBlessed:WindBlessedState;
  polymath:PolymathState;
  soother:SootherState;
  potionProfessor:PotionProfessorState;
  artisan:ArtisanState;
  hypnotist:HypnotistState;
  conspirator:ConspiratorState;
  faceless:FacelessState;
  harvestpriest:HarvestpriestState;
  physician:PhysicianState;
  cultivator:CultivatorState;
  interrogator:InterrogatorState;
  sheriff:SheriffState;
  arbiter:ArbiterState;
  briber:BriberState;
  barbarian:BarbarianState;
  lawyer:LawyerState;
  lucky:LuckyState;
  machine:MachineState;
  monster:MonsterState;
  werewolf:WerewolfState;
  madman:MadmanState;
  prisoner:PrisonerState;
  serialKiller:SerialKillerState;
  unwinged:UnwingedState;
  criminal:CriminalState;
  shadowAscetic:ShadowAsceticState;
  listener:ListenerState;
  secretSupplicant:SecretSupplicantState;
  wizard:WizardState;
  combatScholar:CombatScholarState;
  pryer:PryerState;
  witch:WitchState;
  instigator:InstigatorState;
  assassin:AssassinState;
  weaponmaster:WeaponmasterState;
  gladiator:GladiatorState;
  warrior:WarriorState;
  cryptologist:CryptologistState;
  swindler:SwindlerState;
  marauder:MarauderState;
  astrologer:AstrologerState;
  trickmaster:TrickmasterState;
  apprentice:ApprenticeState;
  spiritmedium:SpiritmediumState;
  gravedigger:GravediggerState;
  corpsecollector:CorpsecollectorState;
  sunpriest:SunpriestState;
  lightprayer:LightprayerState;
  bard:BardState;
  navigator:NavigatorState;
  rager:RagerState;
  sailor:SailorState;
  detective:DetectiveState;
  reasoner:ReasonerState;
  reader:ReaderState;
  nightmare:NightmareState;
  midnight:MidnightState;
  sleepless:SleeplessState;
  vampire:VampireState;
  appraiser:AppraiserState;
  psychologist:PsychologistState;
  pyromaniac:PyromaniacState;
  magician:MagicianState;
  tamer:TamerState;
  apothecary:ApothecaryState;
  archaeologist:ArchaeologistState;
  savant:SavantState;
  town:TownState;
  mindreader:MindreaderState;
  audience:AudienceState;
  provoker:ProvokerState;
  hunter:HunterState;
  clown:ClownState;
  caseArchive:SliceEnding[];
  schemaVersion: 176; contentVersion: 'elder-v176'; runId: string; revision: number;
  status: 'ACTIVE' | 'SLICE_COMPLETE' | 'DEAD' | 'REVIVAL_PENDING'; character: SliceCharacter;
  week: number; date: PublicGameDate; actionsRemaining: number; weeklyBudget: number; wagePaidWeek: number | null;
  cash: number; lifeTier: SliceLifeTier; nextLifeTier: SliceLifeTier; health: number; mind: number; spirituality: number;
  injuries: SliceInjury[]; injuryRisk: number; debts: SliceDebt[]; missedWeeks: number; credit: 'NORMAL' | 'NOTICE' | 'SUSPENDED';
  knownTargets: string[]; completedTopics: string[]; knowledge: SliceRecord[]; chronicle: SliceRecord[];
  activeEvent: { id: string; instanceId: string } | null; eventQueue: string[];
  pulse: 'NONE' | 'BILL' | 'DEBTS' | 'ADVANCE'; billAmount: number; lastMedicalInviteWeek: number | null;
  aid: 'NONE' | 'ACCEPTED' | 'CORRECT' | 'DELIVERED' | 'CANCELLED'; aidInjuryIds: string[];
  marketUnlocked: boolean; careKnown: boolean; arc: SliceArc; world: SliceWorld;
  combat: SliceCombatState | null; lastCombatRound: SliceCombatRound | null; combatHistory: SliceCombatRound[];
  lastCheck: PublicCheckResult | null; lastResult: SliceRecord | null; ending: SliceEnding | null;
  random: { seed: string; cursor: number };
  progression:ProgressionState; seer:SeerState;
}
/** Deliberately constructed allow-list, never a spread of SliceState. */
export interface SliceProjection {
  recovery: SliceRecoveryProjection;
  elder:ElderProjection;
  sage:SageProjection;
  calamityDemoness:CalamityDemonessProjection;
  glory:GloryProjection;
  fateTrojan:FateTrojanProjection;
  planeswalker:PlaneswalkerProjection;
  deathConsul:DeathConsulProjection;
  lightSeeker:LightSeekerProjection;
  catastrophe:CatastropheProjection;
  wisdomAngel:WisdomAngelProjection;
  concealmentServant:ConcealmentServantProjection;
  lifeGiver:LifeGiverProjection;
  knowledgeMentor:KnowledgeMentorProjection;
  discerner:DiscernerProjection;
  weatherWarlock:WeatherWarlockProjection;
  miracleWorker:MiracleWorkerProjection;
  coffinBearer:CoffinBearerProjection;
  chaosHunter:ChaosHunterProjection;
  frenzyMage:FrenzyMageProjection;
  chaosWalker:ChaosWalkerProjection;
  silentDisciple:SilentDiscipleProjection;
  blatherer:BlathererProjection;
  threeHeadedTemplar:ThreeHeadedTemplarProjection;
  prophecyMaster:ProphecyMasterProjection;
  unagingDemoness:UnagingDemonessProjection;
  silverKnight:SilverKnightProjection;
  deceitMentor:DeceitMentorProjection;
  wanderer:WandererProjection;
  ferryman:FerrymanProjection;
  justiceMentor:JusticeMentorProjection;
  seaKing:SeaKingProjection;
  insightScholar:InsightScholarProjection;
  fearBishop:FearBishopProjection;
  summoningMaster:SummoningMasterProjection;
  arcaneScholar:ArcaneScholarProjection;
  dreamWeaver:DreamWeaverProjection;
  warBishop:WarBishopProjection;
  ancientScholar:AncientScholarProjection;
  longChapter:LongChapterProjection;
  ancientAlchemist:AncientAlchemistProjection;
  imperativeMage:ImperativeMageProjection;
  fallenEarl:FallenEarlProjection;
  misfortuneMage:MisfortuneMageProjection;
  puppet:PuppetProjection;
  devil:DevilProjection;
  blackKnight:BlackKnightProjection;
  mystic:MysticProjection;
  despair:DespairProjection;
  demonHunter:DemonHunterProjection;
  parasite:ParasiteProjection;
  secretsSorcerer:SecretsSorcererProjection;
  undying:UndyingProjection;
  unshadowed:UnshadowedProjection;
  cataclysmPriest:CataclysmPriestProjection;
  prophet:ProphetProjection;
  nightwatcher:NightwatcherProjection;
  witchKing:WitchKingProjection;
  alchemist:AlchemistProjection;
  manipulator:ManipulatorProjection;
  ironBloodKnight:IronBloodKnightProjection;
  bizarroSorcerer:BizarroSorcererProjection;
  druid:DruidProjection;
  punishmentKnight:PunishmentKnightProjection;
  mentorDisorder:MentorDisorderProjection;
  winner:WinnerProjection;
  wraith:WraithProjection;
  desireApostle:DesireApostleProjection;
  shepherd:ShepherdProjection;
  starMystic:StarMysticProjection;
  pain:PainProjection;
  guardian:GuardianProjection;
  dreamStealer:DreamStealerProjection;
  traveler:TravelerProjection;
  gatekeeper:GatekeeperProjection;
  priestOfLight:PriestOfLightProjection;
  oceanSinger:OceanSingerProjection;
  mysticismMagister:MysticismMagisterProjection;
  spiritWarlock:SpiritWarlockProjection;
  crimsonScholar:CrimsonScholarProjection;
  astronomer:AstronomerProjection;
  dreamwalker:DreamwalkerProjection;
  reaper:ReaperProjection;
  marionettist:MarionettistProjection;
  biologist:BiologistProjection;
  judge:JudgeProjection;
  corruptionBaron:CorruptionBaronProjection;
  calamityPriest:CalamityPriestProjection;
  zombie:ZombieProjection;
  demon:DemonProjection;
  roseBishop:RoseBishopProjection;
  scrollProfessor:ScrollProfessorProjection;
  pleasure:PleasureProjection;
  dawnPaladin:DawnPaladinProjection;
  fireThief:FireThiefProjection;
  recorder:RecorderProjection;
  spiritGuide:SpiritGuideProjection;
  notary:NotaryProjection;
  windBlessed:WindBlessedProjection;
  polymath:PolymathProjection;
  soother:SootherProjection;
  potionProfessor:PotionProfessorProjection;
  artisan:ArtisanProjection;
  hypnotist:HypnotistProjection;
  conspirator:ConspiratorProjection;
  faceless:FacelessProjection;
  harvestpriest:HarvestpriestProjection;
  physician:PhysicianProjection;
  cultivator:CultivatorProjection;
  interrogator:InterrogatorProjection;
  sheriff:SheriffProjection;
  arbiter:ArbiterProjection;
  briber:BriberProjection;
  barbarian:BarbarianProjection;
  lawyer:LawyerProjection;
  lucky:LuckyProjection;
  machine:MachineProjection;
  monster:MonsterProjection;
  werewolf:WerewolfProjection;
  madman:MadmanProjection;
  prisoner:PrisonerProjection;
  serialKiller:SerialKillerProjection;
  unwinged:UnwingedProjection;
  criminal:CriminalProjection;
  shadowAscetic:ShadowAsceticProjection;
  listener:ListenerProjection;
  secretSupplicant:SecretSupplicantProjection;
  wizard:WizardProjection;
  combatScholar:CombatScholarProjection;
  pryer:PryerProjection;
  witch:WitchProjection;
  instigator:InstigatorProjection;
  assassin:AssassinProjection;
  weaponmaster:WeaponmasterProjection;
  gladiator:GladiatorProjection;
  warrior:WarriorProjection;
  cryptologist:CryptologistProjection;
  swindler:SwindlerProjection;
  marauder:MarauderProjection;
  astrologer:AstrologerProjection;
  trickmaster:TrickmasterProjection;
  apprentice:ApprenticeProjection;
  spiritmedium:SpiritmediumProjection;
  gravedigger:GravediggerProjection;
  corpsecollector:CorpsecollectorProjection;
  sunpriest:SunpriestProjection;
  lightprayer:LightprayerProjection;
  bard:BardProjection;
  navigator:NavigatorProjection;
  rager:RagerProjection;
  sailor:SailorProjection;
  detective:DetectiveProjection;
  reasoner:ReasonerProjection;
  reader:ReaderProjection;
  nightmare:NightmareProjection;
  midnight:MidnightProjection;
  sleepless:SleeplessProjection;
  vampire:VampireProjection;
  appraiser:AppraiserProjection;
  psychologist:PsychologistProjection;
  pyromaniac:PyromaniacProjection;
  magician:MagicianProjection;
  tamer:TamerProjection;
  apothecary:ApothecaryProjection;
  archaeologist:ArchaeologistProjection;
  savant:SavantProjection;
  town:TownProjection;
  mindreader:MindreaderProjection;
  audience:AudienceProjection;
  provoker:ProvokerProjection;
  hunter:HunterProjection;
  clown:ClownProjection;
  caseArchive:SliceEnding[];
  progression:ProgressionState; seer:SeerProjection;
  runId: string; revision: number; status: SliceState['status']; character: SliceCharacter;
  week: number; date: PublicGameDate; actionsRemaining: number; weeklyBudget: number;
  cash: number; lifeTier: SliceLifeTier; nextLifeTier: SliceLifeTier; weeklyWage: number; wagePaid: boolean;
  health: number; mind: number; spirituality: number; maxHealth: 100; maxMind: 100; maxSpirituality: number; pollution: number;
  injuries: SliceInjury[]; injuryRisk: number; debtTotal: number; debts: SliceDebt[]; missedWeeks: number; credit: SliceState['credit'];
  learnTargets: SliceTarget[]; investigateTargets: SliceTarget[]; canAct: boolean; actionBlockedReason: string | null;
  activeEvent: SliceEvent | null; combat: SliceCombatProjection | null; lastCombatRound: SliceCombatRound | null; combatHistory: SliceCombatRound[];
  lastResult: SliceRecord | null; lastCheck: PublicCheckResult | null; chronicle: SliceRecord[]; knowledge: SliceRecord[];
  ending: SliceEnding | null; nextStep: string; aidCanCancel: boolean; marketUnlocked: boolean;
}
