import type { PrinceOfAbolitionCaseId } from '../../src/domain/prince-of-abolition/life.js';
import type { PrinceOfAbolitionAbilityId } from '../../src/domain/prince-of-abolition/types.js';

export const PRINCE_OF_ABOLITION_METADATA_FILES = ['natural.json', 'source-prefix.json', 'commands.jsonl', 'public.jsonl',
  'boundaries.index.json', 'boundaries.steps.json', 'transitions.json', 'summary.json', 'capture-integrity.json'] as const;
export const PRINCE_OF_ABOLITION_CAPTURE_STAGES = [
  'NATURAL743_PREFIX_PUBLIC_PRINCE_OF_ABOLITION_CONTINUATION', 'SAME_SEED_FINITE_POTION_FAILURES_ALIVE_S2',
  'ACTUAL_FINITE_ENCOUNTER_UNRESOLVED', 'ACTUAL_TERMINAL_WITH_NATURAL743_HISTORY',
] as const;
export interface PrinceOfAbolitionObservedCapture {
  observedAt: string; producerSha256: string; saveVerifierSha256: string; freezeSha256: string;
  metadataHashes: Record<typeof PRINCE_OF_ABOLITION_METADATA_FILES[number], string>;
  files: number; bytes: number; commands: number; namedBoundaries: number; uniqueTransitions: number; aliases: number;
  stage: typeof PRINCE_OF_ABOLITION_CAPTURE_STAGES[number]; error: string | null; failurePhase: string; pendingIntent: unknown;
  snapshots: string[]; boundarySteps: Record<string, number>; provenance: unknown; strategy: unknown;
  originalBody: unknown; originalCharacter: unknown; originalMastery: Record<string, number>;
  final: unknown; finalRawStateSha256: string;
  promotionWeek: number | null; treatments: unknown[]; bottles: unknown;
  lifeAbilityUse: Record<PrinceOfAbolitionAbilityId, { paidAttempts: number; castingSuccesses: number; actualApplications: number;
    reportedApplications: number; spiritualitySpent: number; mindSpent: number }>;
  combatAbilityUse: Record<PrinceOfAbolitionAbilityId, { selectedSlots: number; paidAttempts: number; castingSuccesses: number;
    unresistedSuccesses: number; resistedAttempts: number; preparedWindows: number; actualApplications: number;
    contributionChange: number; masteryApplications: number; spiritualitySpent: number; mindSpent: number; supportWearPaid: number }>;
  completedCases: PrinceOfAbolitionCaseId[]; combatRounds: number[]; consequenceDomains: (string | null)[]; terminal: unknown;
  /** Select only actual distinct transitions after inspecting the real index. No speculative aliases. */
  sqliteRepresentatives: string[];
}

// Literal observations extracted from the immutable coordinator capture on 2026-10-16.
// Extraction read JSON, file sizes and hashes only; no game runtime or reroll.
// Full public control/compact-state evidence is pinned by public.jsonl; full
// public projection equality is checked by tests rather than inventing an absent artifact.
export const PRINCE_OF_ABOLITION_CAPTURE_EVIDENCE: {
  sourceSha256: string; priorSha256: string; prefixSha256: string; inheritedSha256: string;
  observed: PrinceOfAbolitionObservedCapture | null;
} = {
  "sourceSha256": "3dbb2166121b85a02883455a5604df7c44a50ce6102d7dd65d5c9720b4ed32f1",
  "priorSha256": "4c986d2f7583cb3bc1595451ce600ec673febb8426970d32f20d3de24afad695",
  "prefixSha256": "5ca248f2de1259b8734afd15e3fd91dab300b737beaeca106e0ea8667289686d",
  "inheritedSha256": "d8043f248a0396f352390c2e2392bdcc885b7deff8eeb4264b027dc201787a96",
  "observed": {
    "observedAt": "2026-10-16T11:23:16Z",
    "producerSha256": "5d1a9bc13ae88a1526c0368a51b3da452aaee8a3810b1e8efb8c859428a6e14d",
    "saveVerifierSha256": "e7c7ecbc1ef8465726a5a84b82d5a518cb681fe1f40bd55f04ee858cba85ae65",
    "freezeSha256": "4d272242b746a5bd57b1c477a9082c5c9051cc4dc26e569305bb3aff2ec0374d",
    "metadataHashes": {
      "natural.json": "116e7060455dbde907758f92af3fb20f6de8f0e15b248f44bb895d4a78e03dfa",
      "source-prefix.json": "ec2bd5ec1279088a7fbbf5d5faf6f98a68ec62643253ace8e69277ff6f812293",
      "commands.jsonl": "aaf25c57075e379a0a0bf70ec6cc89857f9884d15310a565a14a5b4cf91a6fb7",
      "public.jsonl": "76954d5c0086c257e4be60d741c81a78b1320e812fdc45c80f58a910c0f0311f",
      "boundaries.index.json": "d37661f917c4babfb63d08f9b5efaa32ebd03606cfb8c9b039e1ceb14674bb95",
      "boundaries.steps.json": "d132c1f506ff62e08037614b235b55478b0785f2fe28e0580f2030420d03c416",
      "transitions.json": "69836e45d00b06b9acc5810b185bf51abc93ef2d78d0dca05a61bc5d0a57cabc",
      "summary.json": "2c3a8fa8a96a206adc63b54812d469048ca64af76aa707017289962914980e74",
      "capture-integrity.json": "c929212a12e0c56c6ec7a4de88c1f32722c5c516e53c6e7567b2f3ada8959da3"
    },
    "files": 198,
    "bytes": 1148287773,
    "commands": 924,
    "namedBoundaries": 246,
    "uniqueTransitions": 182,
    "aliases": 64,
    "stage": "NATURAL743_PREFIX_PUBLIC_PRINCE_OF_ABOLITION_CONTINUATION",
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
      "exact-original743-living-source": 743,
      "paid500-guidance-freezes-eight-roots-and-original-gift-stock": 744,
      "preparation-verify_originals": 745,
      "preparation-check_limits": 746,
      "actual-week-finance-settlement": 746,
      "preparation-check_return": 747,
      "prince-of-abolition-potion-1-actual-labour": 748,
      "prince-of-abolition-potion-1-actual-labour-2": 749,
      "actual-week-finance-settlement-2": 749,
      "prince-of-abolition-potion-1-actual-labour-3": 750,
      "prince-of-abolition-potion-1-actual-labour-4": 751,
      "prince-of-abolition-potion-1-actual-labour-5": 752,
      "actual-week-finance-settlement-3": 752,
      "step-753-action": 753,
      "step-754-action": 754,
      "step-755-action": 755,
      "actual-week-finance-settlement-4": 755,
      "step-756-action": 756,
      "step-757-action": 757,
      "step-758-action": 758,
      "actual-week-finance-settlement-5": 758,
      "step-759-action": 759,
      "step-760-action": 760,
      "step-761-action": 761,
      "actual-week-finance-settlement-6": 761,
      "step-762-action": 762,
      "step-763-action": 763,
      "step-764-action": 764,
      "actual-week-finance-settlement-7": 764,
      "step-765-action": 765,
      "step-766-action": 766,
      "step-767-action": 767,
      "actual-week-finance-settlement-8": 767,
      "step-768-action": 768,
      "step-769-action": 769,
      "step-770-action": 770,
      "actual-week-finance-settlement-9": 770,
      "step-771-action": 771,
      "paid1200-prince-of-abolition-potion-1": 772,
      "step-773-action": 773,
      "step-774-action": 774,
      "actual-week-finance-settlement-10": 774,
      "step-775-action": 775,
      "paid180-current-week-prepare-prince-of-abolition-potion-1": 776,
      "consume-prince-of-abolition-potion-1": 777,
      "actual-potion-failure": 777,
      "prince-of-abolition-potion-2-actual-labour": 778,
      "actual-week-finance-settlement-11": 778,
      "prince-of-abolition-potion-2-actual-labour-2": 779,
      "prince-of-abolition-potion-2-actual-labour-3": 780,
      "prince-of-abolition-potion-2-actual-labour-4": 781,
      "actual-week-finance-settlement-12": 781,
      "prince-of-abolition-potion-2-actual-labour-5": 782,
      "step-783-action": 783,
      "step-784-action": 784,
      "actual-week-finance-settlement-13": 784,
      "step-785-action": 785,
      "step-786-action": 786,
      "step-787-action": 787,
      "actual-week-finance-settlement-14": 787,
      "step-788-action": 788,
      "step-789-action": 789,
      "step-790-action": 790,
      "actual-week-finance-settlement-15": 790,
      "step-791-action": 791,
      "step-792-action": 792,
      "step-793-action": 793,
      "actual-week-finance-settlement-16": 793,
      "step-794-action": 794,
      "step-795-action": 795,
      "step-796-action": 796,
      "actual-week-finance-settlement-17": 796,
      "step-797-action": 797,
      "step-798-action": 798,
      "step-799-action": 799,
      "actual-week-finance-settlement-18": 799,
      "step-800-action": 800,
      "step-801-action": 801,
      "step-802-action": 802,
      "actual-week-finance-settlement-19": 802,
      "step-803-action": 803,
      "paid1200-prince-of-abolition-potion-2": 804,
      "step-805-action": 805,
      "step-806-action": 806,
      "actual-week-finance-settlement-20": 806,
      "step-807-action": 807,
      "paid180-current-week-prepare-prince-of-abolition-potion-2": 808,
      "consume-prince-of-abolition-potion-2": 809,
      "actual-potion-failure-2": 809,
      "prince-of-abolition-potion-3-actual-labour": 810,
      "actual-event-life-bill-01": 811,
      "actual-week-finance-settlement-21": 811,
      "actual-zero-ap-command": 811,
      "prince-of-abolition-potion-3-actual-labour-2": 812,
      "prince-of-abolition-potion-3-actual-labour-3": 813,
      "prince-of-abolition-potion-3-actual-labour-4": 814,
      "actual-event-life-bill-01-2": 815,
      "actual-week-finance-settlement-22": 815,
      "actual-zero-ap-command-2": 815,
      "prince-of-abolition-potion-3-actual-labour-5": 816,
      "step-817-action": 817,
      "step-818-action": 818,
      "actual-week-finance-settlement-23": 818,
      "step-819-action": 819,
      "step-820-action": 820,
      "step-821-action": 821,
      "actual-week-finance-settlement-24": 821,
      "step-822-action": 822,
      "step-823-action": 823,
      "step-824-action": 824,
      "actual-week-finance-settlement-25": 824,
      "step-825-action": 825,
      "step-826-action": 826,
      "step-827-action": 827,
      "actual-week-finance-settlement-26": 827,
      "step-828-action": 828,
      "step-829-action": 829,
      "step-830-action": 830,
      "actual-week-finance-settlement-27": 830,
      "step-831-action": 831,
      "step-832-action": 832,
      "step-833-action": 833,
      "actual-week-finance-settlement-28": 833,
      "step-834-action": 834,
      "step-835-action": 835,
      "step-836-action": 836,
      "actual-week-finance-settlement-29": 836,
      "step-837-action": 837,
      "step-838-action": 838,
      "step-839-action": 839,
      "actual-week-finance-settlement-30": 839,
      "step-840-action": 840,
      "paid1200-prince-of-abolition-potion-3": 841,
      "step-842-action": 842,
      "step-843-action": 843,
      "actual-week-finance-settlement-31": 843,
      "step-844-action": 844,
      "paid180-current-week-prepare-prince-of-abolition-potion-3": 845,
      "consume-prince-of-abolition-potion-3": 846,
      "promotion": 846,
      "walk-four-metres-to-actual-outside": 847,
      "actual-four-metre-original-room-exit": 847,
      "pay40-place-new-annex-receiver": 848,
      "actual-week-finance-settlement-32": 848,
      "actual-paid-annex-placed": 848,
      "directed-throw-observe-originals-and-new-annex": 849,
      "directed-throw-consent-owner": 850,
      "directed-throw-consent-cooperation": 851,
      "directed-throw-consent-ability": 852,
      "directed-throw-prepare": 853,
      "directed-throw-take_ball": 854,
      "directed-throw-walk_to_annex": 855,
      "directed-throw-inspect": 856,
      "directed-throw-prepare_action": 857,
      "directed-throw-directed_amplification": 858,
      "directed-throw-amplification-actual-window": 858,
      "directed-throw-actual-charge-consumption": 858,
      "directed-throw-throw_ball": 859,
      "directed-throw-actual-throw-amplified": 859,
      "directed-throw-wait_flight": 860,
      "directed-throw-actual-flight-lands": 860,
      "directed-throw-walk_to_receiver": 861,
      "directed-throw-retrieve_ball": 862,
      "directed-throw-return_to_annex": 863,
      "directed-throw-return_to_outside": 864,
      "directed-throw-return_objects": 865,
      "directed-throw-leave": 866,
      "directed-throw-ordinary-closure-ability": 866,
      "directed-throw-honest-report": 867,
      "actual-event-life-bill-01-3": 868,
      "actual-week-finance-settlement-33": 868,
      "actual-zero-ap-command-3": 868,
      "step-869-action": 869,
      "step-870-action": 870,
      "step-871-action": 871,
      "actual-week-finance-settlement-34": 871,
      "maintained-flight-observe-originals-and-new-annex": 872,
      "maintained-flight-consent-owner": 873,
      "maintained-flight-consent-cooperation": 874,
      "maintained-flight-consent-ability": 875,
      "maintained-flight-prepare": 876,
      "maintained-flight-take_ball": 877,
      "maintained-flight-walk_to_annex": 878,
      "maintained-flight-inspect": 879,
      "maintained-flight-prepare_action": 880,
      "maintained-flight-throw_ball": 881,
      "maintained-flight-actual-throw-ordinary": 881,
      "maintained-flight-effect_maintenance": 882,
      "maintained-flight-maintenance-actual-application": 882,
      "maintained-flight-actual-charge-consumption": 882,
      "maintained-flight-wait_flight": 883,
      "maintained-flight-wait_flight-2": 884,
      "maintained-flight-wait_flight-3": 885,
      "maintained-flight-actual-flight-lands": 885,
      "maintained-flight-walk_to_receiver": 886,
      "maintained-flight-retrieve_ball": 887,
      "maintained-flight-return_to_annex": 888,
      "maintained-flight-return_to_outside": 889,
      "maintained-flight-return_objects": 890,
      "maintained-flight-leave": 891,
      "maintained-flight-ordinary-closure-ability": 891,
      "maintained-flight-honest-report": 892,
      "actual-week-finance-settlement-35": 892,
      "withdrawn-input-observe-originals-and-new-annex": 893,
      "withdrawn-input-consent-owner": 894,
      "withdrawn-input-consent-cooperation": 895,
      "withdrawn-input-consent-ability": 896,
      "withdrawn-input-prepare": 897,
      "withdrawn-input-take_ball": 898,
      "withdrawn-input-walk_to_annex": 899,
      "withdrawn-input-inspect": 900,
      "withdrawn-input-prepare_action": 901,
      "withdrawn-input-directed_amplification": 902,
      "withdrawn-input-amplification-actual-window": 902,
      "withdrawn-input-actual-charge-consumption": 902,
      "withdrawn-input-withdraw_consent-ability": 903,
      "withdrawn-input-permission-ability-withdrawn": 903,
      "withdrawn-input-throw_ball": 904,
      "withdrawn-input-actual-throw-ordinary": 904,
      "withdrawn-input-wait_flight": 905,
      "withdrawn-input-actual-flight-lands": 905,
      "withdrawn-input-walk_to_receiver": 906,
      "withdrawn-input-retrieve_ball": 907,
      "withdrawn-input-return_to_annex": 908,
      "withdrawn-input-return_to_outside": 909,
      "withdrawn-input-return_objects": 910,
      "withdrawn-input-leave": 911,
      "withdrawn-input-ordinary-closure-ordinary": 911,
      "withdrawn-input-honest-report": 912,
      "actual-week-finance-settlement-36": 912,
      "three-honest-reports-reflected": 913,
      "step-914-action": 914,
      "step-915-action": 915,
      "actual-week-finance-settlement-37": 915,
      "paid30-three-independent-combat-support-pieces": 916,
      "original-adults-remain-outside-player-walks-to-new-yard": 917,
      "independent-optional-edmund-fight": 918,
      "combat-round-1": 919,
      "combat-actual-directed-amplification": 919,
      "combat-round-2": 920,
      "combat-round-3": 921,
      "combat-round-4": 922,
      "combat-actual-original-gift-consumption": 922,
      "combat-round-5": 923,
      "combat-round-6": 924,
      "actual-ordinary-encounter-exit": 924
    },
    "provenance": {
      "kind": "EXACT743_PUBLIC_ENTROPY_DUKE_THEN_PUBLIC_PRINCE_OF_ABOLITION",
      "prior": {
        "kind": "SAME_SEED_ORIGINAL_LIVING_PREFIX_PUBLIC_CONTINUATION",
        "source": "tests/fixtures/frenzy-mage-v01590/natural.json",
        "sourceSha256": "4c986d2f7583cb3bc1595451ce600ec673febb8426970d32f20d3de24afad695",
        "newRandomChanges": false
      },
      "source": "tests/fixtures/entropy-duke-v01830/natural.json",
      "sourceSha256": "3dbb2166121b85a02883455a5604df7c44a50ce6102d7dd65d5c9720b4ed32f1",
      "sourceRoot": "final",
      "inheritedDirectedPrefix": false,
      "fullNaturalS9ToS1": true,
      "newRandomChanges": false
    },
    "strategy": {
      "source": "EXACT743_FULL_LIVING_ENTROPY_DUKE_FINAL",
      "sourceSeed": "lawyer-natural-v063",
      "sourceCursor": 228,
      "caseMethod": "ABILITY",
      "caseRoute": "CURRENT_PUBLIC_PREFERRED_ACTION_ONCE_EACH_WITH_ORDINARY_COMPLETION_IF_POWER_FAILS",
      "encounterPolicy": "ALL",
      "combatStance": "CONTROL",
      "combatRoundCap": 90,
      "potionAttemptCap": 12,
      "maxCommands": 3500,
      "ordinaryPreparationCap": 600,
      "caseCommandCap": 80,
      "sourceInjuryRecovery": "NONE_HEALTHY_ORIGINAL743",
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
        "spirituality": 8
      },
      "encounterReadiness": {
        "ap": 2,
        "cash": 30,
        "mind": 3
      },
      "annexReadiness": {
        "ap": 1,
        "cash": 40
      },
      "afterCases": "NO_OPTIONAL_MAXIMUM_RECOVERY_STOP_AFTER_ACTUAL_LIVING_EXIT_AND_DUE_SETTLEMENT",
      "gifts": "ONLY_ORIGINAL_PLAYER_HELD_13_14_15_IN_NEW_ROOT_ARE_LIVE_AFTER_GUIDANCE",
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
      "revision": 744,
      "week": 185,
      "date": {
        "epoch": "FIFTH_EPOCH",
        "year": 1353,
        "month": 1,
        "day": 6
      },
      "H": 100,
      "M": 95,
      "S": 94,
      "cash": 800,
      "AP": 3,
      "pollution": 0,
      "injuries": [],
      "injuryRisk": 0,
      "random": {
        "seed": "lawyer-natural-v063",
        "cursor": 228
      },
      "sequence": 2,
      "acting": 100,
      "mastery": {
        "black-emperor.s9.rule-analysis": 32,
        "black-emperor.s9.persuasive-argument": 16,
        "black-emperor.s9.weak-point-insight": 33,
        "black-emperor.s8.enhanced-body": 41,
        "black-emperor.s8.mental-resistance": 65,
        "black-emperor.s7.bribery-weakening": 0,
        "black-emperor.s6.distortion": 25,
        "black-emperor.s5.disorder": 0,
        "black-emperor.s4.bestow": 8,
        "black-emperor.s4.magnify": 8,
        "black-emperor.s4.exploit": 8,
        "black-emperor.s3.ordered-deviation": 0,
        "black-emperor.s2.action-amplification": 8,
        "black-emperor.s2.effect-prolongation": 8
      },
      "finance": {
        "weeklyBudget": 3,
        "wagePaidWeek": 184,
        "lifeTier": "DESTITUTE",
        "nextLifeTier": "DESTITUTE",
        "debts": [
          {
            "id": "debt-30-116-0",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 30
          },
          {
            "id": "debt-39-150-1",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 39
          },
          {
            "id": "debt-43-168-2",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 43
          },
          {
            "id": "debt-44-173-3",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 44
          },
          {
            "id": "debt-109-411-4",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 109
          },
          {
            "id": "debt-110-417-5",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 110
          },
          {
            "id": "debt-111-423-6",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 111
          },
          {
            "id": "debt-175-672-7",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 175
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
        "physique": 29,
        "perception": 23,
        "will": 25,
        "knowledge": 23
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
      "black-emperor.s9.rule-analysis": 32,
      "black-emperor.s9.persuasive-argument": 16,
      "black-emperor.s9.weak-point-insight": 33,
      "black-emperor.s8.enhanced-body": 41,
      "black-emperor.s8.mental-resistance": 65,
      "black-emperor.s7.bribery-weakening": 0,
      "black-emperor.s6.distortion": 25,
      "black-emperor.s5.disorder": 0,
      "black-emperor.s4.bestow": 8,
      "black-emperor.s4.magnify": 8,
      "black-emperor.s4.exploit": 8,
      "black-emperor.s3.ordered-deviation": 0,
      "black-emperor.s2.action-amplification": 8,
      "black-emperor.s2.effect-prolongation": 8
    },
    "final": {
      "status": "ACTIVE",
      "revision": 925,
      "week": 222,
      "date": {
        "epoch": "FIFTH_EPOCH",
        "year": 1353,
        "month": 9,
        "day": 22
      },
      "H": 80,
      "M": 71,
      "S": 97,
      "cash": 140,
      "AP": 1,
      "pollution": 0,
      "injuries": [
        {
          "id": "lawyer-rebuild-natural:combat:1:PLAYER:920:0",
          "severity": "LIGHT",
          "acquiredRevision": 920,
          "treatedRevision": null
        },
        {
          "id": "lawyer-rebuild-natural:combat:5:PLAYER:924:1",
          "severity": "LIGHT",
          "acquiredRevision": 924,
          "treatedRevision": null
        }
      ],
      "injuryRisk": 1,
      "random": {
        "seed": "lawyer-natural-v063",
        "cursor": 315
      },
      "sequence": 1,
      "acting": 100,
      "mastery": {
        "black-emperor.s9.rule-analysis": 32,
        "black-emperor.s9.persuasive-argument": 16,
        "black-emperor.s9.weak-point-insight": 33,
        "black-emperor.s8.enhanced-body": 41,
        "black-emperor.s8.mental-resistance": 65,
        "black-emperor.s7.bribery-weakening": 0,
        "black-emperor.s6.distortion": 25,
        "black-emperor.s5.disorder": 0,
        "black-emperor.s4.bestow": 8,
        "black-emperor.s4.magnify": 8,
        "black-emperor.s4.exploit": 8,
        "black-emperor.s3.ordered-deviation": 0,
        "black-emperor.s2.action-amplification": 40,
        "black-emperor.s2.effect-prolongation": 8,
        "black-emperor.s1.directed-amplification": 16,
        "black-emperor.s1.effect-maintenance": 8
      },
      "finance": {
        "weeklyBudget": 3,
        "wagePaidWeek": 221,
        "lifeTier": "DESTITUTE",
        "nextLifeTier": "DESTITUTE",
        "debts": [
          {
            "id": "debt-30-116-0",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 30
          },
          {
            "id": "debt-39-150-1",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 39
          },
          {
            "id": "debt-43-168-2",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 43
          },
          {
            "id": "debt-44-173-3",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 44
          },
          {
            "id": "debt-109-411-4",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 109
          },
          {
            "id": "debt-110-417-5",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 110
          },
          {
            "id": "debt-111-423-6",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 111
          },
          {
            "id": "debt-175-672-7",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 175
          },
          {
            "id": "debt-205-812-8",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 205
          },
          {
            "id": "debt-206-816-9",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 206
          },
          {
            "id": "debt-217-869-10",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 217
          }
        ],
        "missedWeeks": 0,
        "credit": "NORMAL",
        "pulse": "NONE",
        "billAmount": 0
      }
    },
    "finalRawStateSha256": "29884ce25f4e53df01bf56aa812174c18bf278313ce6f2176b0313a7325c3124",
    "promotionWeek": 216,
    "treatments": [],
    "bottles": [
      {
        "id": "prince-of-abolition-potion-1",
        "source": "米蕾介绍的专业交接处的独立弑序亲王成品渠道第1批、第185周实际登记的第1瓶序列1成品，独立封存编号prince-of-abolition-potion-1；本瓶独立劳动、交付与耗用，不补回旧瓶。",
        "stockedWeek": 185,
        "labourSteps": 5,
        "acquiredWeek": 194,
        "consumedWeek": 195,
        "preparationWeek": 195,
        "status": "CONSUMED",
        "outcome": "FAILURE"
      },
      {
        "id": "prince-of-abolition-potion-2",
        "source": "米蕾介绍的专业交接处的独立弑序亲王成品渠道第1批、第185周实际登记的第2瓶序列1成品，独立封存编号prince-of-abolition-potion-2；本瓶独立劳动、交付与耗用，不补回旧瓶。",
        "stockedWeek": 185,
        "labourSteps": 5,
        "acquiredWeek": 204,
        "consumedWeek": 205,
        "preparationWeek": 205,
        "status": "CONSUMED",
        "outcome": "FAILURE"
      },
      {
        "id": "prince-of-abolition-potion-3",
        "source": "米蕾介绍的专业交接处的独立弑序亲王成品渠道第1批、第185周实际登记的第3瓶序列1成品，独立封存编号prince-of-abolition-potion-3；本瓶独立劳动、交付与耗用，不补回旧瓶。",
        "stockedWeek": 185,
        "labourSteps": 5,
        "acquiredWeek": 215,
        "consumedWeek": 216,
        "preparationWeek": 216,
        "status": "CONSUMED",
        "outcome": "SUCCESS"
      }
    ],
    "lifeAbilityUse": {
      "black-emperor.s1.directed-amplification": {
        "paidAttempts": 2,
        "castingSuccesses": 2,
        "actualApplications": 1,
        "reportedApplications": 1,
        "spiritualitySpent": 16,
        "mindSpent": 4
      },
      "black-emperor.s1.effect-maintenance": {
        "paidAttempts": 1,
        "castingSuccesses": 1,
        "actualApplications": 1,
        "reportedApplications": 1,
        "spiritualitySpent": 8,
        "mindSpent": 2
      }
    },
    "combatAbilityUse": {
      "black-emperor.s1.directed-amplification": {
        "selectedSlots": 2,
        "paidAttempts": 2,
        "castingSuccesses": 1,
        "unresistedSuccesses": 1,
        "resistedAttempts": 0,
        "preparedWindows": 1,
        "actualApplications": 1,
        "contributionChange": 35,
        "masteryApplications": 1,
        "spiritualitySpent": 16,
        "mindSpent": 6,
        "supportWearPaid": 2
      },
      "black-emperor.s1.effect-maintenance": {
        "selectedSlots": 5,
        "paidAttempts": 1,
        "castingSuccesses": 1,
        "unresistedSuccesses": 0,
        "resistedAttempts": 1,
        "preparedWindows": 0,
        "actualApplications": 0,
        "contributionChange": 0,
        "masteryApplications": 0,
        "spiritualitySpent": 8,
        "mindSpent": 4,
        "supportWearPaid": 1
      }
    },
    "completedCases": [
      "directed-throw",
      "maintained-flight",
      "withdrawn-input"
    ],
    "combatRounds": [
      1,
      2,
      3,
      4,
      5,
      6
    ],
    "consequenceDomains": [
      "BODY",
      "MENTAL"
    ],
    "terminal": {
      "outcome": "ENEMY_SURRENDERED",
      "round": 6,
      "historyIndex": 21,
      "enemyHealth": 50,
      "enemyMind": 100,
      "enemySpirituality": 73,
      "enemyStatus": "SURRENDERED",
      "exitMetres": 4,
      "exitSeconds": 4
    },
    "sqliteRepresentatives": [
      "exact-original743-living-source",
      "paid500-guidance-freezes-eight-roots-and-original-gift-stock",
      "paid1200-prince-of-abolition-potion-1",
      "paid1200-prince-of-abolition-potion-2",
      "paid1200-prince-of-abolition-potion-3",
      "consume-prince-of-abolition-potion-1",
      "consume-prince-of-abolition-potion-2",
      "consume-prince-of-abolition-potion-3",
      "walk-four-metres-to-actual-outside",
      "pay40-place-new-annex-receiver",
      "directed-throw-prepare",
      "directed-throw-directed_amplification",
      "directed-throw-throw_ball",
      "maintained-flight-effect_maintenance",
      "withdrawn-input-withdraw_consent-ability",
      "withdrawn-input-throw_ball",
      "directed-throw-return_objects",
      "directed-throw-leave",
      "three-honest-reports-reflected",
      "paid30-three-independent-combat-support-pieces",
      "original-adults-remain-outside-player-walks-to-new-yard",
      "independent-optional-edmund-fight",
      "combat-round-1",
      "combat-round-6",
      "combat-actual-original-gift-consumption"
    ]
  }
};
