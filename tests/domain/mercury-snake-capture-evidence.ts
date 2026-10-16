import type { MercurySnakeCaseId } from '../../src/domain/mercury-snake/life.js';
import type { MercurySnakeAbilityId } from '../../src/domain/mercury-snake/types.js';

export interface LifeAbilityObservation {
  paidAttempts: number; castingSuccesses: number; actualApplications: number; reportedApplications: number;
}
export interface CombatAbilityObservation {
  selectedSlots: number; paidAttempts: number; castingSuccesses: number; preparedWindows: number;
  actualApplications: number; contributionReduction: number; masteryApplications: number; spiritualitySpent: number; mindSpent: number;
}
export const MERCURY_SNAKE_METADATA_FILES = ['natural.json', 'source-prefix.json', 'commands.jsonl', 'public.jsonl',
  'boundaries.index.json', 'boundaries.steps.json', 'transitions.json', 'summary.json', 'capture-integrity.json'] as const;
export interface MercurySnakeObservedCapture {
  observedAt: string; producerSha256: string; freezeSha256: string;
  metadataHashes: Record<typeof MERCURY_SNAKE_METADATA_FILES[number], string>;
  files: number; bytes: number; commands: number; namedBoundaries: number; uniqueTransitions: number; aliases: number;
  stage: string; error: string | null; failurePhase: string; pendingIntent: unknown;
  snapshots: string[]; boundarySteps: Record<string, number>; provenance: unknown; strategy: unknown;
  originalBody: unknown; originalCharacter: unknown; originalMastery: Record<string, number>; final: unknown;
  promotionWeek: number | null; treatments: unknown[];
  lifeAbilityUse: Record<MercurySnakeAbilityId, LifeAbilityObservation>;
  combatAbilityUse: Record<MercurySnakeAbilityId, CombatAbilityObservation>;
  completedCases: MercurySnakeCaseId[]; combatRounds: number[]; consequenceDomains: ('BODY' | 'MENTAL')[]; terminal: unknown;
}

// Literal observations from the immutable coordinator capture. Extraction only
// reads JSON and hashes files; it never imports a reducer or searches outcomes.
// Both potion results, failed/withdrawn life casts and the unused anchor remain.
export const MERCURY_SNAKE_CAPTURE_EVIDENCE: {
  sourceSha256: string; priorSha256: string; prefixSha256: string;
  observed: MercurySnakeObservedCapture | null;
} = {
  "sourceSha256": "52688eebc9ef8bf3d548195aa174b1f04a517adcce5d2fc6a3bef57a901f86cb",
  "priorSha256": "eb42c6205279a77bd6c19f7ea0946181e2b6df8e31201f8ba1126fa51d928ce2",
  "prefixSha256": "4df6da64c0f6577694da6e21122a02b86730d74eb672780d87e8e22854f8b2fe",
  "observed": {
    "observedAt": "2026-10-16T08:36:41.012981+00:00",
    "producerSha256": "2047bb94c73442cbe8be3505ad9d2ddd393dccca026fea8670aa5a163a266e86",
    "freezeSha256": "fb1107cca1f1e07c8f8d141c421a5dd7916d042c68499cb0510b0df379793bfd",
    "metadataHashes": {
      "natural.json": "6d4542561817368ec18b535ee6195084412f97f356c00d511b8cf57c8198d574",
      "source-prefix.json": "e3fdb204dcc28946432ba9746eb343f0b85645db65b1826f8912adf3a9eb5b23",
      "commands.jsonl": "12f032ac6a3a120ed42ca4025e8fe8d812c5851102ef072047a7d46f79c0ede0",
      "public.jsonl": "c3704242c80f332c4838288cb40e879d969423f83eedc0c68ef069f6c2e4341f",
      "boundaries.index.json": "d77b34b57d43228fd8dc0baeea5f1bbbdd43ebe47d2836fc1bb0f4a5aa5099ca",
      "boundaries.steps.json": "d179c4c9590b8b3c5277bf245cb4e2e82dfef12edc81758c9c98d31a7e7c8ba6",
      "transitions.json": "ee6b25ebb7a7d43f00bc1598d2f1057de91c0c78303ddefb4100ac15fd097667",
      "summary.json": "41b534b2d29c608826a3945c6f3acc75c5fde429fd45edb60769d57fbe045bf8",
      "capture-integrity.json": "baa2ea408b2d274314b0b062de265fb3775d0a9f8b1f07a81544145b1e49480d"
    },
    "files": 154,
    "bytes": 773058564,
    "commands": 841,
    "namedBoundaries": 182,
    "uniqueTransitions": 139,
    "aliases": 43,
    "stage": "NATURAL703_PREFIX_PUBLIC_MERCURY_SNAKE_CONTINUATION",
    "error": null,
    "failurePhase": "IDLE",
    "pendingIntent": null,
    "snapshots": [
      "departure",
      "guidance",
      "promoted",
      "practiced",
      "beforeEncounter",
      "combatStart",
      "combatTerminal"
    ],
    "boundarySteps": {
      "exact-original703-living-source": 703,
      "paid500-guidance-freezes-eight-roots-and-original-luck": 704,
      "preparation-verify_originals": 705,
      "actual-week-finance-settlement": 705,
      "preparation-check_limits": 706,
      "preparation-check_return": 707,
      "mercury-snake-potion-1-actual-labour": 708,
      "actual-week-finance-settlement-2": 708,
      "mercury-snake-potion-1-actual-labour-2": 709,
      "mercury-snake-potion-1-actual-labour-3": 710,
      "mercury-snake-potion-1-actual-labour-4": 711,
      "actual-week-finance-settlement-3": 711,
      "mercury-snake-potion-1-actual-labour-5": 712,
      "step-713-action": 713,
      "step-714-action": 714,
      "actual-week-finance-settlement-4": 714,
      "step-715-action": 715,
      "step-716-action": 716,
      "step-717-action": 717,
      "actual-week-finance-settlement-5": 717,
      "step-718-action": 718,
      "step-719-action": 719,
      "step-720-action": 720,
      "actual-week-finance-settlement-6": 720,
      "step-721-action": 721,
      "step-722-action": 722,
      "step-723-action": 723,
      "actual-week-finance-settlement-7": 723,
      "step-724-action": 724,
      "paid1200-mercury-snake-potion-1": 725,
      "step-726-action": 726,
      "step-727-action": 727,
      "actual-week-finance-settlement-8": 727,
      "step-728-action": 728,
      "paid180-current-week-prepare-mercury-snake-potion-1": 729,
      "consume-mercury-snake-potion-1": 730,
      "actual-potion-failure": 730,
      "mercury-snake-potion-2-actual-labour": 731,
      "actual-event-life-bill-01": 732,
      "actual-week-finance-settlement-9": 732,
      "actual-zero-ap-command": 732,
      "mercury-snake-potion-2-actual-labour-2": 733,
      "mercury-snake-potion-2-actual-labour-3": 734,
      "mercury-snake-potion-2-actual-labour-4": 735,
      "actual-event-life-bill-01-2": 736,
      "actual-week-finance-settlement-10": 736,
      "actual-zero-ap-command-2": 736,
      "mercury-snake-potion-2-actual-labour-5": 737,
      "step-738-action": 738,
      "step-739-action": 739,
      "actual-week-finance-settlement-11": 739,
      "step-740-action": 740,
      "step-741-action": 741,
      "step-742-action": 742,
      "actual-week-finance-settlement-12": 742,
      "step-743-action": 743,
      "step-744-action": 744,
      "step-745-action": 745,
      "actual-week-finance-settlement-13": 745,
      "step-746-action": 746,
      "step-747-action": 747,
      "step-748-action": 748,
      "actual-week-finance-settlement-14": 748,
      "step-749-action": 749,
      "step-750-action": 750,
      "step-751-action": 751,
      "actual-week-finance-settlement-15": 751,
      "step-752-action": 752,
      "step-753-action": 753,
      "step-754-action": 754,
      "actual-week-finance-settlement-16": 754,
      "step-755-action": 755,
      "step-756-action": 756,
      "step-757-action": 757,
      "actual-week-finance-settlement-17": 757,
      "step-758-action": 758,
      "step-759-action": 759,
      "step-760-action": 760,
      "actual-week-finance-settlement-18": 760,
      "step-761-action": 761,
      "paid1200-mercury-snake-potion-2": 762,
      "step-763-action": 763,
      "step-764-action": 764,
      "actual-week-finance-settlement-19": 764,
      "step-765-action": 765,
      "paid180-current-week-prepare-mercury-snake-potion-2": 766,
      "consume-mercury-snake-potion-2": 767,
      "promotion": 767,
      "step-768-action": 768,
      "actual-week-finance-settlement-20": 768,
      "cart-return-observe-original-room": 769,
      "cart-return-consent-owner": 770,
      "cart-return-consent-ability": 771,
      "cart-return-invite": 772,
      "cart-return-prepare": 773,
      "cart-return-walk_to_a": 774,
      "cart-return-walk_to_b": 775,
      "cart-return-read_original": 776,
      "cart-return-return_to_a": 777,
      "cart-return-place_piece": 778,
      "cart-return-capture_moment": 779,
      "cart-return-release_cart": 780,
      "cart-return-local_restart": 781,
      "cart-return-restart-actual-application": 781,
      "cart-return-actual-charge-consumption": 781,
      "cart-return-return_object": 782,
      "cart-return-take_piece": 783,
      "cart-return-return_to_entry": 784,
      "cart-return-return_piece": 785,
      "cart-return-leave": 786,
      "cart-return-ordinary-closure-restart": 786,
      "cart-return-honest-report": 787,
      "actual-week-finance-settlement-21": 787,
      "maintained-contact-observe-original-room": 788,
      "maintained-contact-consent-owner": 789,
      "maintained-contact-consent-ability": 790,
      "maintained-contact-invite": 791,
      "maintained-contact-prepare": 792,
      "maintained-contact-walk_to_a": 793,
      "maintained-contact-walk_to_b": 794,
      "maintained-contact-read_original": 795,
      "maintained-contact-return_to_a": 796,
      "maintained-contact-place_piece": 797,
      "maintained-contact-capture_moment": 798,
      "maintained-contact-moment_anchor": 799,
      "maintained-contact-anchor-actual-failed-window": 799,
      "maintained-contact-release_cart": 800,
      "maintained-contact-local_restart": 801,
      "maintained-contact-restart-actual-nonapplication": 801,
      "maintained-contact-walk_to_b-2": 802,
      "maintained-contact-push_back": 803,
      "maintained-contact-return_object": 804,
      "maintained-contact-take_piece": 805,
      "maintained-contact-return_to_entry": 806,
      "maintained-contact-return_piece": 807,
      "maintained-contact-leave": 808,
      "maintained-contact-ordinary-closure-ordinary": 808,
      "maintained-contact-honest-report": 809,
      "actual-event-life-bill-01-3": 810,
      "actual-week-finance-settlement-22": 810,
      "actual-zero-ap-command-3": 810,
      "step-811-action": 811,
      "step-812-action": 812,
      "step-813-action": 813,
      "actual-week-finance-settlement-23": 813,
      "withdrawn-contact-observe-original-room": 814,
      "withdrawn-contact-consent-owner": 815,
      "withdrawn-contact-consent-ability": 816,
      "withdrawn-contact-invite": 817,
      "withdrawn-contact-prepare": 818,
      "withdrawn-contact-walk_to_a": 819,
      "withdrawn-contact-walk_to_b": 820,
      "withdrawn-contact-read_original": 821,
      "withdrawn-contact-return_to_a": 822,
      "withdrawn-contact-place_piece": 823,
      "withdrawn-contact-capture_moment": 824,
      "withdrawn-contact-moment_anchor": 825,
      "withdrawn-contact-anchor-actual-window": 825,
      "withdrawn-contact-withdraw_consent-ability": 826,
      "withdrawn-contact-permission-ability-withdrawn": 826,
      "withdrawn-contact-release_cart": 827,
      "withdrawn-contact-walk_to_b-2": 828,
      "withdrawn-contact-push_back": 829,
      "withdrawn-contact-return_object": 830,
      "withdrawn-contact-take_piece": 831,
      "withdrawn-contact-return_to_entry": 832,
      "withdrawn-contact-return_piece": 833,
      "withdrawn-contact-leave": 834,
      "withdrawn-contact-ordinary-closure-ordinary": 834,
      "withdrawn-contact-honest-report": 835,
      "actual-week-finance-settlement-24": 835,
      "three-honest-reports-reflected": 836,
      "paid30-independent-three-charge-combat-piece": 837,
      "original-adults-actually-leave-player-walks-to-new-yard": 838,
      "independent-optional-oswin-fight": 839,
      "combat-round-1": 840,
      "actual-zero-ap-command-4": 840,
      "combat-round-2": 841,
      "actual-week-finance-settlement-25": 841,
      "actual-zero-ap-command-5": 841,
      "combat-actual-local-restart": 841,
      "actual-ordinary-encounter-exit": 841
    },
    "provenance": {
      "kind": "EXACT703_PUBLIC_FATE_PROPHET_THEN_PUBLIC_MERCURY_SNAKE",
      "prior": {
        "kind": "SAME_SEED_COMPLETE_PUBLIC_CONTINUATION",
        "source": "tests/fixtures/chaos-walker-v01580/natural.json",
        "sourceSha256": "eb42c6205279a77bd6c19f7ea0946181e2b6df8e31201f8ba1126fa51d928ce2",
        "newRandomChanges": false
      },
      "source": "tests/fixtures/fate-prophet-v01820/natural.json",
      "sourceSha256": "52688eebc9ef8bf3d548195aa174b1f04a517adcce5d2fc6a3bef57a901f86cb",
      "sourceRoot": "final",
      "inheritedDirectedPrefix": false,
      "fullNaturalS9ToS1": true,
      "newRandomChanges": false
    },
    "strategy": {
      "source": "EXACT703_FULL_LIVING_FATE_PROPHET_FINAL",
      "sourceSeed": "monster-natural-v060",
      "sourceCursor": 269,
      "caseMethod": "ABILITY",
      "caseRoute": "CURRENT_PUBLIC_PREFERRED_ACTION_ONCE_EACH_WITH_ORDINARY_COMPLETION_IF_POWER_FAILS",
      "encounterPolicy": "ALL",
      "combatStance": "CONTROL",
      "winnerPolicy": "HOLD",
      "combatRoundCap": 90,
      "potionAttemptCap": 12,
      "maxCommands": 3500,
      "ordinaryPreparationCap": 600,
      "caseCommandCap": 80,
      "sourceInjuryRecovery": "ORDINARY_REST_MAY_CLEAR_ORIGINAL_ONE_LIGHT_NO_COMPULSORY_CLINIC",
      "ordinaryActions": "WORK_ONCE_PER_WEEK_THEN_REST",
      "recovery": {
        "health": 100,
        "mind": 100,
        "spirituality": 120,
        "pollution": 0
      },
      "caseReadiness": {
        "ap": 3,
        "cash": 20,
        "mind": 8,
        "spirituality": 16
      },
      "encounterReadiness": {
        "ap": 2,
        "cash": 30
      },
      "afterCases": "NO_OPTIONAL_MAXIMUM_RECOVERY_STOP_AFTER_ACTUAL_LIVING_EXIT_AND_DUE_SETTLEMENT",
      "luck": "NO_ACCUMULATION_OR_SPENDING_ON_THIS_ROUTE_ORIGINAL_ZERO_REMAINS_ZERO",
      "eventChoices": {
        "ORIGIN": ".decline",
        "LIFE-BILL-01": "PAY_PART",
        "DEBT-NOTICE-01": "DECLINE",
        "DEBT-SETTLE-01": "DEFER",
        "LIFE-CARE-01": "PAY",
        "CARE-WORK-OFFER": "DECLINE"
      }
    },
    "originalBody": {
      "status": "ACTIVE",
      "revision": 704,
      "week": 177,
      "date": {
        "epoch": "FIFTH_EPOCH",
        "year": 1352,
        "month": 11,
        "day": 11
      },
      "cash": 1060,
      "injuries": [
        {
          "id": "monster-rebuild-natural:combat:2:PLAYER:702:0",
          "severity": "LIGHT",
          "acquiredRevision": 702,
          "treatedRevision": null
        }
      ],
      "injuryRisk": 0,
      "random": {
        "seed": "monster-natural-v060",
        "cursor": 269
      },
      "H": 90,
      "M": 95,
      "S": 119,
      "AP": 2,
      "pollution": 0,
      "mastery": {
        "wheel.s9.spirit-sensitivity": 57,
        "wheel.s9.fragmentary-omen": 57,
        "wheel.s9.danger-intuition": 8,
        "wheel.s8.calculation-control": 41,
        "wheel.s8.divination-guard": 41,
        "wheel.s7.passive-luck": 0,
        "wheel.s6.disaster-awareness": 0,
        "wheel.s6.disaster-attraction": 0,
        "wheel.s6.mental-storm": 8,
        "wheel.s5.luck-reserve": 0,
        "wheel.s5.ill-fortune": 0,
        "wheel.s4.precaution-practice": 8,
        "wheel.s4.bounded-misfortune": 8,
        "wheel.s3.deviation-buffer": 8,
        "wheel.s3.future-impediment": 8,
        "wheel.s2.event-foresight": 8,
        "wheel.s2.hazard-adjustment": 0
      },
      "sequence": 2,
      "acting": 100,
      "finance": {
        "weeklyBudget": 3,
        "wagePaidWeek": 177,
        "lifeTier": "DESTITUTE",
        "nextLifeTier": "DESTITUTE",
        "debts": [
          {
            "id": "debt-23-91-0",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 23
          },
          {
            "id": "debt-24-95-1",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 24
          },
          {
            "id": "debt-28-112-2",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 28
          },
          {
            "id": "debt-29-117-3",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 29
          },
          {
            "id": "debt-30-122-4",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 30
          },
          {
            "id": "debt-88-339-5",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 88
          },
          {
            "id": "debt-89-343-6",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 89
          },
          {
            "id": "debt-90-347-7",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 90
          },
          {
            "id": "debt-131-495-8",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 131
          },
          {
            "id": "debt-149-586-9",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 149
          },
          {
            "id": "debt-157-613-10",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 157
          }
        ],
        "missedWeeks": 0,
        "credit": "NORMAL",
        "pulse": "NONE",
        "billAmount": 0
      }
    },
    "originalCharacter": {
      "name": "艾洛",
      "portraitId": "portrait-01",
      "age": 26,
      "gender": "FEMALE",
      "originId": "origin-labor-1",
      "originName": "工厂工资家庭",
      "professionId": "profession-factory-worker",
      "professionName": "工厂工人",
      "education": "BASIC",
      "learningBonus": 0,
      "weeklyWage": 180,
      "coreStats": {
        "physique": 26,
        "perception": 25,
        "will": 23,
        "knowledge": 24
      },
      "birthplace": {
        "id": "birthplace-backlund",
        "label": "贝克兰德"
      },
      "appearanceDescription": "",
      "traits": [
        {
          "id": "trait.diligent",
          "label": "勤勉"
        },
        {
          "id": "trait.watchful",
          "label": "警觉"
        }
      ],
      "flaw": {
        "id": "flaw.timid",
        "label": "畏缩"
      },
      "acceptedConditionIds": [],
      "creationCosts": {
        "professionInitialPence": 120,
        "familyTransferPence": 120,
        "conditionCostPence": 0,
        "educationCostPence": 0
      }
    },
    "originalMastery": {
      "wheel.s9.spirit-sensitivity": 57,
      "wheel.s9.fragmentary-omen": 57,
      "wheel.s9.danger-intuition": 8,
      "wheel.s8.calculation-control": 41,
      "wheel.s8.divination-guard": 41,
      "wheel.s7.passive-luck": 0,
      "wheel.s6.disaster-awareness": 0,
      "wheel.s6.disaster-attraction": 0,
      "wheel.s6.mental-storm": 8,
      "wheel.s5.luck-reserve": 0,
      "wheel.s5.ill-fortune": 0,
      "wheel.s4.precaution-practice": 8,
      "wheel.s4.bounded-misfortune": 8,
      "wheel.s3.deviation-buffer": 8,
      "wheel.s3.future-impediment": 8,
      "wheel.s2.event-foresight": 8,
      "wheel.s2.hazard-adjustment": 0
    },
    "final": {
      "status": "ACTIVE",
      "revision": 842,
      "week": 202,
      "date": {
        "epoch": "FIFTH_EPOCH",
        "year": 1353,
        "month": 5,
        "day": 5
      },
      "H": 90,
      "M": 88,
      "S": 86,
      "cash": 20,
      "AP": 3,
      "pollution": 0,
      "injuries": [
        {
          "id": "monster-rebuild-natural:combat:1:PLAYER:841:0",
          "severity": "LIGHT",
          "acquiredRevision": 841,
          "treatedRevision": null
        }
      ],
      "injuryRisk": 0,
      "random": {
        "seed": "monster-natural-v060",
        "cursor": 306
      },
      "sequence": 1,
      "acting": 100,
      "mastery": {
        "wheel.s9.spirit-sensitivity": 57,
        "wheel.s9.fragmentary-omen": 57,
        "wheel.s9.danger-intuition": 8,
        "wheel.s8.calculation-control": 41,
        "wheel.s8.divination-guard": 41,
        "wheel.s7.passive-luck": 0,
        "wheel.s6.disaster-awareness": 0,
        "wheel.s6.disaster-attraction": 0,
        "wheel.s6.mental-storm": 8,
        "wheel.s5.luck-reserve": 0,
        "wheel.s5.ill-fortune": 0,
        "wheel.s4.precaution-practice": 8,
        "wheel.s4.bounded-misfortune": 8,
        "wheel.s3.deviation-buffer": 8,
        "wheel.s3.future-impediment": 8,
        "wheel.s2.event-foresight": 8,
        "wheel.s2.hazard-adjustment": 0,
        "wheel.s1.local-restart": 16,
        "wheel.s1.moment-anchor": 0
      },
      "finance": {
        "weeklyBudget": 3,
        "wagePaidWeek": 199,
        "lifeTier": "DESTITUTE",
        "nextLifeTier": "DESTITUTE",
        "debts": [
          {
            "id": "debt-23-91-0",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 23
          },
          {
            "id": "debt-24-95-1",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 24
          },
          {
            "id": "debt-28-112-2",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 28
          },
          {
            "id": "debt-29-117-3",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 29
          },
          {
            "id": "debt-30-122-4",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 30
          },
          {
            "id": "debt-88-339-5",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 88
          },
          {
            "id": "debt-89-343-6",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 89
          },
          {
            "id": "debt-90-347-7",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 90
          },
          {
            "id": "debt-131-495-8",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 131
          },
          {
            "id": "debt-149-586-9",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 149
          },
          {
            "id": "debt-157-613-10",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 157
          },
          {
            "id": "debt-185-733-11",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 185
          },
          {
            "id": "debt-186-737-12",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 186
          },
          {
            "id": "debt-198-811-13",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 198
          }
        ],
        "missedWeeks": 0,
        "credit": "NORMAL",
        "pulse": "NONE",
        "billAmount": 0
      }
    },
    "promotionWeek": 196,
    "treatments": [],
    "lifeAbilityUse": {
      "wheel.s1.local-restart": {
        "paidAttempts": 2,
        "castingSuccesses": 1,
        "actualApplications": 1,
        "reportedApplications": 1
      },
      "wheel.s1.moment-anchor": {
        "paidAttempts": 2,
        "castingSuccesses": 1,
        "actualApplications": 0,
        "reportedApplications": 0
      }
    },
    "combatAbilityUse": {
      "wheel.s1.local-restart": {
        "selectedSlots": 3,
        "paidAttempts": 3,
        "castingSuccesses": 2,
        "preparedWindows": 2,
        "actualApplications": 1,
        "contributionReduction": 25,
        "masteryApplications": 1,
        "spiritualitySpent": 24,
        "mindSpent": 8
      },
      "wheel.s1.moment-anchor": {
        "selectedSlots": 1,
        "paidAttempts": 1,
        "castingSuccesses": 1,
        "preparedWindows": 1,
        "actualApplications": 0,
        "contributionReduction": 0,
        "masteryApplications": 0,
        "spiritualitySpent": 8,
        "mindSpent": 2
      }
    },
    "completedCases": [
      "cart-return",
      "maintained-contact",
      "withdrawn-contact"
    ],
    "combatRounds": [
      1,
      2
    ],
    "consequenceDomains": [
      "BODY"
    ],
    "terminal": {
      "outcome": "ENEMY_SURRENDERED",
      "round": 2,
      "historyIndex": 18,
      "enemyHealth": 70,
      "enemyMind": 100,
      "enemySpirituality": 95,
      "enemyStatus": "SURRENDERED",
      "windowWaitSeconds": 0,
      "exitMetres": 4,
      "exitSeconds": 4
    }
  }
};
