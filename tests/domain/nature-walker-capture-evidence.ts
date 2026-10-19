export const NATURE_WALKER_METADATA_FILES = ['natural.json', 'source-prefix.json', 'commands.jsonl', 'public.jsonl',
  'boundaries.index.json', 'boundaries.steps.json', 'transitions.json', 'summary.json', 'capture-integrity.json'] as const;
export const NATURE_WALKER_CAPTURE_STAGES = ['NATURAL851_PREFIX_PUBLIC_NATURE_WALKER_CONTINUATION', 'SAME_SEED_FINITE_POTION_FAILURES_ALIVE_S2',
  'ACTUAL_FINITE_ENCOUNTER_UNRESOLVED', 'ACTUAL_TERMINAL_WITH_NATURAL851_HISTORY'] as const;
export interface NatureWalkerObservedCapture {
  observedAt: string; producerSha256: string; saveVerifierSha256: string; freezeSha256: string;
  /** One full in-memory reducer replay has its own Windows-suitable budget. */
  replayTimeoutMs: 600000; metadataHashes: Record<typeof NATURE_WALKER_METADATA_FILES[number], string>;
  files: number; bytes: number; commands: number; namedBoundaries: number; uniqueTransitions: number; aliases: number;
  stage: typeof NATURE_WALKER_CAPTURE_STAGES[number]; error: string | null; failurePhase: string; pendingIntent: unknown;
  snapshots: string[]; boundarySteps: Record<string, number>; provenance: unknown; strategy: unknown;
  originalBody: unknown; originalCharacter: unknown; originalMastery: Record<string, number>; final: unknown; finalRawStateSha256: string;
  promotionWeek: number | null; treatments: unknown[]; bottles: unknown; lifeAbilityUse: unknown; combatAbilityUse: unknown;
  completedCases: string[]; combatRounds: number[]; consequenceDomains: (string | null)[]; terminal: unknown; sqliteRepresentatives: string[];
}
// Literal observations read from the coordinator-confirmed completed capture.
// All immutable members were hashed with JSON/fs/crypto only; no producer is imported.
export const NATURE_WALKER_CAPTURE_EVIDENCE: {
  sourceSha256: string; predecessorSha256: string; prefixSha256: string; inheritedSha256: string;
  observed: NatureWalkerObservedCapture | null;
} = {
  "sourceSha256": "cd557e330303c6ce9efaf9960544f28eb8a4f9058182a1860a38f4edb7298caf",
  "predecessorSha256": "731c25059489305fc3699c1bdc6fb39489590f30a0f149417210ae4f6aef0fdc",
  "prefixSha256": "aa8329a36876dbd7dd1f74011991da3f1c28eea916be77ae8d61738ff32c6d0a",
  "inheritedSha256": "27112c23acd8ec0a12397b2c1503f982f34ae9f6a0e2ace65b40a5e5e1001aa5",
  "observed": {
    "observedAt": "2026-10-16T16:24:48Z",
    "producerSha256": "08f8a8b74c6d1502a60245a712a465a6c1e1cde0eeb60a55675d6641e09001fd",
    "saveVerifierSha256": "6a76d46c9269f13cfc286cebd009e2abadc4b84986247b0dffb380213a899032",
    "freezeSha256": "03a780d4a9108a526c3e778d7ad6a21171cc72cde24871fd56c2bc51c02d88bc",
    "replayTimeoutMs": 600000,
    "metadataHashes": {
      "natural.json": "620cd1a94fd3a4c89abf6359c8126a564383bee51dc6fdfbd2442e4cca67916c",
      "source-prefix.json": "5743fefc8a159fab502b8317340274534b42a15a96d69d2941cf29e5465e803b",
      "commands.jsonl": "a7a4fe8af3fc6d42c36d07f3d34b5f0b694f345144ebfe612b02e3e9d8a1ac56",
      "public.jsonl": "52ceb71c23b98ee1f0490deb4564939ed4fba517e5203ba8c4a1fbb4f0db6258",
      "boundaries.index.json": "1d0f66c4a3f9e3f1216b42bd06d81447c4f798880bbb57c45f17bc458cf69ddc",
      "boundaries.steps.json": "78e8d9af36cb9d4cbaca39058af67909a7fd47c4ef7891835800c365a659aa75",
      "transitions.json": "90a24d8b1adb4634800db87ccb8e92cee32bc5f35c852b3e6c88ba921fd1c720",
      "summary.json": "ce58937ff8177f54e37eea719dc8c87f5e15d229733b8cbfccc4d78506445bf9",
      "capture-integrity.json": "534f68cb17c71643483b73d2bde6b5b340d4c82e38016ca46a5f8b348132f560"
    },
    "files": 122,
    "bytes": 516156868,
    "commands": 955,
    "namedBoundaries": 146,
    "uniqueTransitions": 105,
    "aliases": 41,
    "stage": "NATURAL851_PREFIX_PUBLIC_NATURE_WALKER_CONTINUATION",
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
      "combatTerminal",
      "livingContinuation"
    ],
    "boundarySteps": {
      "exact-original851-living-source": 851,
      "paid500-guidance-freezes-eight-roots-and-original-pad50-guard": 852,
      "preparation-verify_originals": 853,
      "preparation-check_limits": 854,
      "actual-week-finance-settlement": 854,
      "preparation-check_return": 855,
      "nature-walker-potion-1-actual-labour": 856,
      "nature-walker-potion-1-actual-labour-2": 857,
      "actual-week-finance-settlement-2": 857,
      "nature-walker-potion-1-actual-labour-3": 858,
      "nature-walker-potion-1-actual-labour-4": 859,
      "nature-walker-potion-1-actual-labour-5": 860,
      "actual-week-finance-settlement-3": 860,
      "step-861-action": 861,
      "step-862-action": 862,
      "step-863-action": 863,
      "actual-week-finance-settlement-4": 863,
      "step-864-action": 864,
      "step-865-action": 865,
      "step-866-action": 866,
      "actual-week-finance-settlement-5": 866,
      "step-867-action": 867,
      "step-868-action": 868,
      "step-869-action": 869,
      "actual-week-finance-settlement-6": 869,
      "step-870-action": 870,
      "step-871-action": 871,
      "step-872-action": 872,
      "actual-week-finance-settlement-7": 872,
      "step-873-action": 873,
      "step-874-action": 874,
      "step-875-action": 875,
      "actual-week-finance-settlement-8": 875,
      "step-876-action": 876,
      "paid1200-nature-walker-potion-1": 877,
      "step-878-action": 878,
      "step-879-action": 879,
      "actual-event-life-bill-01": 880,
      "actual-week-finance-settlement-9": 880,
      "actual-zero-ap-command": 880,
      "step-881-action": 881,
      "paid180-current-week-prepare-nature-walker-potion-1": 882,
      "consume-nature-walker-potion-1": 883,
      "promotion": 883,
      "walk-four-metres-to-actual-outside": 884,
      "actual-four-metre-original-room-exit": 884,
      "step-885-action": 885,
      "actual-event-life-bill-01-2": 886,
      "actual-week-finance-settlement-10": 886,
      "actual-zero-ap-command-2": 886,
      "step-887-action": 887,
      "pay40-place-two-marks-and-three-finite-pieces": 888,
      "actual-paid-workarea-two-marks-three-pieces": 888,
      "step-889-action": 889,
      "actual-week-finance-settlement-11": 889,
      "living-response-observe-originals-and-new-annex": 890,
      "living-response-prepare": 891,
      "living-response-walk": 892,
      "living-response-check_originals": 893,
      "living-response-consent_owner": 894,
      "living-response-setup_objects": 895,
      "living-response-walk-2": 896,
      "living-response-check_sample": 897,
      "living-response-living_response": 898,
      "living-response-response-actual-window": 898,
      "living-response-actual-paid-piece-consumption": 898,
      "living-response-care_check": 899,
      "living-response-actual-care-ability-applied": 899,
      "living-response-return_objects": 900,
      "living-response-walk-3": 901,
      "living-response-walk-4": 902,
      "living-response-inspect": 903,
      "living-response-leave": 904,
      "living-response-ordinary-closure-ability": 904,
      "living-response-honest-report": 905,
      "actual-week-finance-settlement-12": 905,
      "withdrawn-care-observe-originals-and-new-annex": 906,
      "withdrawn-care-prepare": 907,
      "withdrawn-care-walk": 908,
      "withdrawn-care-check_originals": 909,
      "withdrawn-care-consent_owner": 910,
      "withdrawn-care-setup_objects": 911,
      "withdrawn-care-walk-2": 912,
      "withdrawn-care-check_sample": 913,
      "withdrawn-care-living_response": 914,
      "withdrawn-care-response-actual-window": 914,
      "withdrawn-care-actual-paid-piece-consumption": 914,
      "withdrawn-care-withdraw_permission": 915,
      "withdrawn-care-fresh-permission-withdrawn-before-care": 915,
      "withdrawn-care-care_check": 916,
      "withdrawn-care-actual-care-ordinary": 916,
      "withdrawn-care-return_objects": 917,
      "withdrawn-care-walk-3": 918,
      "withdrawn-care-walk-4": 919,
      "withdrawn-care-inspect": 920,
      "withdrawn-care-leave": 921,
      "withdrawn-care-ordinary-closure-ordinary": 921,
      "withdrawn-care-honest-report": 922,
      "actual-week-finance-settlement-13": 922,
      "root-impact-observe-originals-and-new-annex": 923,
      "root-impact-prepare": 924,
      "root-impact-walk": 925,
      "root-impact-check_originals": 926,
      "root-impact-consent_owner": 927,
      "root-impact-setup_objects": 928,
      "root-impact-walk-2": 929,
      "root-impact-check_sample": 930,
      "root-impact-root_bearing": 931,
      "root-impact-root-bearing-actual-window": 931,
      "root-impact-actual-paid-piece-consumption": 931,
      "root-impact-apply_impact": 932,
      "root-impact-actual-impact-ability-applied": 932,
      "root-impact-actual-original-root-pad-wear": 932,
      "root-impact-return_objects": 933,
      "root-impact-walk-3": 934,
      "root-impact-walk-4": 935,
      "root-impact-inspect": 936,
      "root-impact-leave": 937,
      "root-impact-ordinary-closure-ability": 937,
      "root-impact-honest-report": 938,
      "actual-event-life-bill-01-3": 939,
      "actual-week-finance-settlement-14": 939,
      "actual-zero-ap-command-3": 939,
      "three-honest-reports-reflected": 940,
      "step-941-action": 941,
      "step-942-action": 942,
      "actual-week-finance-settlement-15": 942,
      "paid30-three-independent-combat-support-pieces": 943,
      "original-adults-remain-outside-player-walks-to-new-yard": 944,
      "independent-optional-elias-fight": 945,
      "combat-round-1": 946,
      "combat-round-2": 947,
      "combat-round-3": 948,
      "combat-round-4": 949,
      "combat-round-5": 950,
      "combat-actual-original-root-pad-wear": 950,
      "combat-round-6": 951,
      "combat-round-7": 952,
      "combat-actual-original-unused-guard-segment-spent": 952,
      "combat-round-8": 953,
      "combat-actual-original-unused-guard-segment-spent-2": 953,
      "combat-round-9": 954,
      "combat-actual-original-root-pad-wear-2": 954,
      "actual-ordinary-encounter-exit": 954,
      "ordinary-life-after-actual-exit": 955,
      "actual-week-finance-settlement-16": 955
    },
    "provenance": {
      "kind": "EXACT851_PUBLIC_BARREN_MATRIARCH_THEN_PUBLIC_NATURE_WALKER",
      "prior": {
        "kind": "SAME_SEED_ORIGINAL_LIVING_BRANCH_PUBLIC_CONTINUATION",
        "source": "tests/fixtures/coffin-bearer-v01610/natural.json",
        "sourceSha256": "731c25059489305fc3699c1bdc6fb39489590f30a0f149417210ae4f6aef0fdc",
        "newRandomChanges": false
      },
      "source": "tests/fixtures/barren-matriarch-v01850/natural.json",
      "sourceSha256": "cd557e330303c6ce9efaf9960544f28eb8a4f9058182a1860a38f4edb7298caf",
      "sourceRoot": "final",
      "inheritedDirectedPrefix": false,
      "fullNaturalS9ToS1": true,
      "newRandomChanges": false
    },
    "strategy": {
      "source": "EXACT851_FULL_LIVING_BARREN_MATRIARCH_FINAL",
      "sourceSeed": "cultivator-natural-v069",
      "sourceCursor": 238,
      "caseMethod": "ABILITY",
      "caseRoute": "CURRENT_PUBLIC_PREFERRED_ACTION_ONCE_EACH_WITH_ORDINARY_COMPLETION_IF_POWER_FAILS",
      "encounterPolicy": "ALL",
      "combatStance": "CONTROL",
      "combatRoundCap": 90,
      "capExit": "ONE_PUBLIC_RETREAT_IF_AVAILABLE_OTHERWISE_PRESERVE_UNRESOLVED",
      "potionAttemptCap": 12,
      "maxCommands": 3500,
      "ordinaryPreparationCap": 600,
      "caseCommandCap": 80,
      "sourceInjuryRecovery": "NONE_SOURCE_IS_HEALTH100_WITH_NO_INJURIES_NO_FORCED_CLINIC",
      "ordinaryActions": "WORK_ONCE_PER_WEEK_THEN_REST",
      "recovery": {
        "health": 100,
        "mind": 100,
        "spirituality": 120,
        "pollution": 0
      },
      "caseReadiness": {
        "ap": 3,
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
      "afterCases": "NO_OPTIONAL_MAXIMUM_RECOVERY_ONE_ACTUAL_ORDINARY_ACTION_AFTER_LIVING_EXIT_AND_DUE_SETTLEMENT",
      "originalRootPad": "SOLE_LIVE_CONTINUATION_OF_BM2_ROOT_PAD_INTEGRITY50_NO_RESTORE",
      "originalGuard": "SOLE_CB3_GUARD_WITH_ONE_SPENT_TWO_UNUSED_SEGMENTS_NO_RESTORE",
      "livingResponseCombat": "NO_TARGET_ORIGINAL_PLANTS_RETURNED_OUTSIDE_ZERO_COST_ORDINARY_FALLBACK",
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
      "revision": 852,
      "week": 212,
      "date": {
        "epoch": "FIFTH_EPOCH",
        "year": 1353,
        "month": 7,
        "day": 14
      },
      "H": 100,
      "M": 96,
      "S": 114,
      "cash": 885,
      "AP": 3,
      "pollution": 0,
      "injuries": [],
      "injuryRisk": 0,
      "random": {
        "seed": "cultivator-natural-v069",
        "cursor": 238
      },
      "sequence": 2,
      "acting": 100,
      "mastery": {
        "mother.s9.cultivation-knowledge": 25,
        "mother.s9.season-observation": 32,
        "mother.s9.careful-practice": 32,
        "mother.s8.limited-healing": 16,
        "mother.s8.condition-observation": 0,
        "mother.s7.harvest-care": 24,
        "mother.s7.life-support": 25,
        "mother.s6.specimen-study": 0,
        "mother.s6.controlled-trial": 25,
        "mother.s5.ground-passage": 0,
        "mother.s4.vital-knit": 8,
        "mother.s4.living-matrix": 8,
        "mother.s3.finite-preservation": 8,
        "mother.s2.bounded-dormancy": 8,
        "mother.s2.root-buffer": 8
      },
      "finance": {
        "weeklyBudget": 3,
        "wagePaidWeek": 211,
        "lifeTier": "DESTITUTE",
        "nextLifeTier": "DESTITUTE",
        "debts": [
          {
            "id": "debt-24-94-0",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 24
          },
          {
            "id": "debt-46-183-1",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 46
          },
          {
            "id": "debt-96-353-2",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 96
          },
          {
            "id": "debt-106-386-3",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 106
          },
          {
            "id": "debt-107-390-4",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 107
          },
          {
            "id": "debt-108-394-5",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 108
          },
          {
            "id": "debt-119-431-6",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 119
          },
          {
            "id": "debt-120-438-7",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 120
          },
          {
            "id": "debt-132-492-8",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 132
          },
          {
            "id": "debt-133-496-9",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 133
          },
          {
            "id": "debt-140-520-10",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 140
          },
          {
            "id": "debt-165-603-11",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 165
          },
          {
            "id": "debt-166-620-12",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 166
          },
          {
            "id": "debt-185-715-13",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 185
          },
          {
            "id": "debt-193-742-14",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 193
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
        "physique": 28,
        "perception": 24,
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
      "mother.s9.cultivation-knowledge": 25,
      "mother.s9.season-observation": 32,
      "mother.s9.careful-practice": 32,
      "mother.s8.limited-healing": 16,
      "mother.s8.condition-observation": 0,
      "mother.s7.harvest-care": 24,
      "mother.s7.life-support": 25,
      "mother.s6.specimen-study": 0,
      "mother.s6.controlled-trial": 25,
      "mother.s5.ground-passage": 0,
      "mother.s4.vital-knit": 8,
      "mother.s4.living-matrix": 8,
      "mother.s3.finite-preservation": 8,
      "mother.s2.bounded-dormancy": 8,
      "mother.s2.root-buffer": 8
    },
    "final": {
      "status": "ACTIVE",
      "revision": 956,
      "week": 228,
      "date": {
        "epoch": "FIFTH_EPOCH",
        "year": 1353,
        "month": 11,
        "day": 3
      },
      "H": 40,
      "M": 83,
      "S": 114,
      "cash": 255,
      "AP": 3,
      "pollution": 0,
      "injuries": [
        {
          "id": "cultivator-rebuild-natural:combat:2:PLAYER:948:0",
          "severity": "LIGHT",
          "acquiredRevision": 948,
          "treatedRevision": null
        },
        {
          "id": "cultivator-rebuild-natural:combat:3:PLAYER:949:1",
          "severity": "LIGHT",
          "acquiredRevision": 949,
          "treatedRevision": null
        },
        {
          "id": "cultivator-rebuild-natural:combat:7:PLAYER:953:2",
          "severity": "HEAVY",
          "acquiredRevision": 953,
          "treatedRevision": null
        },
        {
          "id": "cultivator-rebuild-natural:combat:8:PLAYER:954:3",
          "severity": "HEAVY",
          "acquiredRevision": 954,
          "treatedRevision": null
        }
      ],
      "injuryRisk": 3,
      "random": {
        "seed": "cultivator-natural-v069",
        "cursor": 349
      },
      "sequence": 1,
      "acting": 100,
      "mastery": {
        "mother.s9.cultivation-knowledge": 25,
        "mother.s9.season-observation": 32,
        "mother.s9.careful-practice": 32,
        "mother.s8.limited-healing": 16,
        "mother.s8.condition-observation": 0,
        "mother.s7.harvest-care": 24,
        "mother.s7.life-support": 25,
        "mother.s6.specimen-study": 0,
        "mother.s6.controlled-trial": 25,
        "mother.s5.ground-passage": 0,
        "mother.s4.vital-knit": 8,
        "mother.s4.living-matrix": 8,
        "mother.s3.finite-preservation": 8,
        "mother.s2.bounded-dormancy": 8,
        "mother.s2.root-buffer": 24,
        "mother.s1.living-response": 8,
        "mother.s1.root-bearing": 8
      },
      "finance": {
        "weeklyBudget": 3,
        "wagePaidWeek": 227,
        "lifeTier": "DESTITUTE",
        "nextLifeTier": "DESTITUTE",
        "debts": [
          {
            "id": "debt-24-94-0",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 24
          },
          {
            "id": "debt-46-183-1",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 46
          },
          {
            "id": "debt-96-353-2",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 96
          },
          {
            "id": "debt-106-386-3",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 106
          },
          {
            "id": "debt-107-390-4",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 107
          },
          {
            "id": "debt-108-394-5",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 108
          },
          {
            "id": "debt-119-431-6",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 119
          },
          {
            "id": "debt-120-438-7",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 120
          },
          {
            "id": "debt-132-492-8",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 132
          },
          {
            "id": "debt-133-496-9",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 133
          },
          {
            "id": "debt-140-520-10",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 140
          },
          {
            "id": "debt-165-603-11",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 165
          },
          {
            "id": "debt-166-620-12",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 166
          },
          {
            "id": "debt-185-715-13",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 185
          },
          {
            "id": "debt-193-742-14",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 193
          },
          {
            "id": "debt-220-881-15",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 220
          },
          {
            "id": "debt-221-887-16",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 221
          },
          {
            "id": "debt-225-940-17",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 225
          }
        ],
        "missedWeeks": 0,
        "credit": "NORMAL",
        "pulse": "NONE",
        "billAmount": 0
      }
    },
    "finalRawStateSha256": "80e22b5ff3073288904d6ffbfc7f422ae27e9f5c363c33f4de4842bb3fdd4271",
    "promotionWeek": 221,
    "treatments": [],
    "bottles": [
      {
        "id": "nature-walker-potion-1",
        "source": "苗圃照料员伊芙·莫兰介绍的专业交接处的独立自然行者成品渠道第1批、第212周实际登记的第1瓶序列1成品，独立封存编号nature-walker-potion-1；本瓶独立劳动、交付与耗用，不补回旧瓶。",
        "stockedWeek": 212,
        "labourSteps": 5,
        "acquiredWeek": 220,
        "consumedWeek": 221,
        "preparationWeek": 221,
        "status": "CONSUMED",
        "outcome": "SUCCESS"
      },
      {
        "id": "nature-walker-potion-2",
        "source": "苗圃照料员伊芙·莫兰介绍的专业交接处的独立自然行者成品渠道第1批、第212周实际登记的第2瓶序列1成品，独立封存编号nature-walker-potion-2；本瓶独立劳动、交付与耗用，不补回旧瓶。",
        "stockedWeek": 212,
        "labourSteps": 0,
        "acquiredWeek": null,
        "consumedWeek": null,
        "preparationWeek": null,
        "status": "SUPPLIER",
        "outcome": null
      },
      {
        "id": "nature-walker-potion-3",
        "source": "苗圃照料员伊芙·莫兰介绍的专业交接处的独立自然行者成品渠道第1批、第212周实际登记的第3瓶序列1成品，独立封存编号nature-walker-potion-3；本瓶独立劳动、交付与耗用，不补回旧瓶。",
        "stockedWeek": 212,
        "labourSteps": 0,
        "acquiredWeek": null,
        "consumedWeek": null,
        "preparationWeek": null,
        "status": "SUPPLIER",
        "outcome": null
      }
    ],
    "lifeAbilityUse": {
      "mother.s1.living-response": {
        "paidAttempts": 2,
        "castingSuccesses": 2,
        "actualApplications": 1,
        "reportedApplications": 1,
        "spiritualitySpent": 16,
        "mindSpent": 4
      },
      "mother.s1.root-bearing": {
        "paidAttempts": 1,
        "castingSuccesses": 1,
        "actualApplications": 1,
        "reportedApplications": 1,
        "spiritualitySpent": 8,
        "mindSpent": 2
      }
    },
    "combatAbilityUse": {
      "mother.s1.living-response": {
        "selectedSlots": 5,
        "paidAttempts": 0,
        "castingSuccesses": 0,
        "unresistedSuccesses": 0,
        "resistedAttempts": 0,
        "preparedWindows": 0,
        "actualApplications": 0,
        "contributionChange": 0,
        "masteryApplications": 0,
        "spiritualitySpent": 0,
        "mindSpent": 0,
        "supportWearPaid": 0
      },
      "mother.s1.root-bearing": {
        "selectedSlots": 4,
        "paidAttempts": 3,
        "castingSuccesses": 1,
        "unresistedSuccesses": 0,
        "resistedAttempts": 1,
        "preparedWindows": 0,
        "actualApplications": 0,
        "contributionChange": 0,
        "masteryApplications": 0,
        "spiritualitySpent": 24,
        "mindSpent": 12,
        "supportWearPaid": 3
      }
    },
    "completedCases": [
      "living-response",
      "withdrawn-care",
      "root-impact"
    ],
    "combatRounds": [
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9
    ],
    "consequenceDomains": [
      "BODY",
      null
    ],
    "terminal": {
      "outcome": "ENEMY_SURRENDERED",
      "round": 9,
      "historyIndex": 25,
      "enemyHealth": 40,
      "enemyMind": 100,
      "enemySpirituality": 53,
      "enemyStatus": "SURRENDERED",
      "exitMetres": 4,
      "exitSeconds": 4
    },
    "sqliteRepresentatives": [
      "exact-original851-living-source",
      "paid500-guidance-freezes-eight-roots-and-original-pad50-guard",
      "paid1200-nature-walker-potion-1",
      "consume-nature-walker-potion-1",
      "walk-four-metres-to-actual-outside",
      "pay40-place-two-marks-and-three-finite-pieces",
      "living-response-prepare",
      "living-response-living_response",
      "living-response-care_check",
      "living-response-return_objects",
      "living-response-leave",
      "withdrawn-care-prepare",
      "withdrawn-care-living_response",
      "withdrawn-care-withdraw_permission",
      "withdrawn-care-care_check",
      "withdrawn-care-return_objects",
      "withdrawn-care-leave",
      "root-impact-prepare",
      "root-impact-root_bearing",
      "root-impact-apply_impact",
      "root-impact-return_objects",
      "root-impact-leave",
      "living-response-honest-report",
      "withdrawn-care-honest-report",
      "root-impact-honest-report",
      "three-honest-reports-reflected",
      "paid30-three-independent-combat-support-pieces",
      "original-adults-remain-outside-player-walks-to-new-yard",
      "independent-optional-elias-fight",
      "combat-round-1",
      "combat-round-3",
      "combat-round-5",
      "combat-round-7",
      "combat-round-9",
      "ordinary-life-after-actual-exit"
    ]
  }
};
