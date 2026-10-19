export const HAND_OF_ORDER_METADATA_FILES = ['natural.json', 'source-prefix.json', 'original-death-source.json', 'commands.jsonl', 'public.jsonl',
  'boundaries.index.json', 'boundaries.steps.json', 'transitions.json', 'summary.json', 'capture-integrity.json'] as const;
export const HAND_OF_ORDER_CAPTURE_STAGES = ['NATURAL594_PREFIX_PUBLIC_HAND_OF_ORDER_CONTINUATION', 'SAME_SEED_FINITE_POTION_FAILURES_ALIVE_S2',
  'ACTUAL_FINITE_ENCOUNTER_UNRESOLVED', 'ACTUAL_TERMINAL_WITH_NATURAL594_HISTORY'] as const;
export interface HandOfOrderObservedCapture {
  observedAt: string; producerSha256: string; saveVerifierSha256: string; freezeSha256: string;
  /** One-case budget is set from the actual coordinator capture duration. */
  replayTimeoutMs: number; metadataHashes: Record<typeof HAND_OF_ORDER_METADATA_FILES[number], string>;
  files: number; bytes: number; commands: number; namedBoundaries: number; uniqueTransitions: number; aliases: number;
  stage: typeof HAND_OF_ORDER_CAPTURE_STAGES[number]; error: string | null; failurePhase: string; pendingIntent: unknown;
  snapshots: string[]; boundarySteps: Record<string, number>; provenance: unknown; strategy: unknown;
  originalBody: unknown; originalCharacter: unknown; originalMastery: Record<string, number>; final: unknown; finalRawStateSha256: string;
  promotionWeek: number | null; treatments: unknown[]; bottles: unknown; lifeAbilityUse: unknown; combatAbilityUse: unknown;
  completedCases: string[]; combatRounds: number[]; consequenceDomains: (string | null)[]; terminal: unknown; sqliteRepresentatives: string[];
}
// Literal observations from coordinator-confirmed immutable capture; extracted with JSON/fs/crypto only.
// Producer took about171s including951MB writes. The full CURRENT reducer replay exceeded its initial300s budget; that one case now has600s, with no global timeout change.
export const HAND_OF_ORDER_CAPTURE_EVIDENCE: {
  sourceSha256: string; recoverySha256: string; deathSha256: string; prefixSha256: string; inheritedSha256: string;
  observed: HandOfOrderObservedCapture | null;
} = {
  "sourceSha256": "e9437ca076c8f9779f8586970308b03032d4b67a13b0588809966818bda264e1",
  "recoverySha256": "3589c7d792bc5974dc79452a9d9f10ae68832da565e97ad88f06f61915f07942",
  "deathSha256": "8e65fcb081f33b5714534acf7d5e47227247ed90e8aa20d00861dc51f2e43588",
  "prefixSha256": "9f0b9d4f125eceb5796712ee310730fbf90f2adbb55e0a79b88f2eb9149bc163",
  "inheritedSha256": "8b4f95f4e200366222296f0c2e37bae1d9ea19ada82bf0f35fdb2f39ac4be841",
  "observed": {
    "observedAt": "2026-10-16T14:11:22Z",
    "producerSha256": "70ab5d7daa9f0a04c9b1cb85cdf47be0c1bb9b5193c23acef061396e9b864ebb",
    "saveVerifierSha256": "bca686d7c234b6e14920e58085251ec7e69a5872f588c2c8e1534c04b1d2b75b",
    "freezeSha256": "82595e0577e1408fe3343da02116e90f99f4ac129af355b3ad57947655dc8b90",
    "replayTimeoutMs": 600000,
    "metadataHashes": {
      "natural.json": "f5b1e8090128b479850acda55353f828a1ee2f122b1feaafd89cc6a18ad94d4a",
      "source-prefix.json": "9e43e88c9c6be4c01ba355d339fd4924077244dfea42475fed18abdcff66970f",
      "original-death-source.json": "835820b4fd7f512acfcf4f5704b58a753217ccfdfc3181e2ea04cacef4ac6094",
      "commands.jsonl": "5cc02b5ba91f07b2e62c6feae26d8d5ef91c2f75940430b70bb161ad90a9377b",
      "public.jsonl": "3f37ccdd3cb6414af79f02fee479564f2a9303f65b9ec39fecdfcc724845e7dc",
      "boundaries.index.json": "57c3cef480c3cbaa1891a5bc9dac0534862174466e55f2b88c0c1530eba89cf2",
      "boundaries.steps.json": "37aa27ce8dfbf36db6adb0868ace25490a809f1a65de8b813ae903b78ec4e7fb",
      "transitions.json": "95bb36bc3b6f0dc923b0bee152bcadd0715ee8f97bc445f4ef51e99701c21c29",
      "summary.json": "1843fbd61f2db968373f4c1c04aa3a7e878c51c58597bbe493bcd18b87ebfe17",
      "capture-integrity.json": "d0580182c43aaf3b9e11cd664f9e30e6bd39c70b3a40d65fd35da24a342b2b89"
    },
    "files": 226,
    "bytes": 951872174,
    "commands": 801,
    "namedBoundaries": 283,
    "uniqueTransitions": 208,
    "aliases": 75,
    "stage": "ACTUAL_TERMINAL_WITH_NATURAL594_HISTORY",
    "error": null,
    "failurePhase": "IDLE",
    "pendingIntent": null,
    "snapshots": [
      "departure",
      "treated",
      "guidance",
      "promoted",
      "practiced",
      "beforeEncounter",
      "combatStart",
      "actualTerminal"
    ],
    "boundarySteps": {
      "exact-original594-living-source": 594,
      "step-595-action": 595,
      "actual-event-life-care-01": 596,
      "actual-clinic-pay60-same-heavy-wound": 596,
      "step-597-action": 597,
      "step-598-action": 598,
      "actual-week-finance-settlement": 598,
      "actual-rest-removes-treated-original-wounds": 598,
      "step-599-action": 599,
      "step-600-action": 600,
      "paid500-guidance-freezes-eight-roots-and-original-guard-plate": 601,
      "actual-week-finance-settlement-2": 601,
      "preparation-verify_originals": 602,
      "preparation-check_limits": 603,
      "preparation-check_return": 604,
      "actual-week-finance-settlement-3": 604,
      "hand-of-order-potion-1-actual-labour": 605,
      "hand-of-order-potion-1-actual-labour-2": 606,
      "hand-of-order-potion-1-actual-labour-3": 607,
      "actual-week-finance-settlement-4": 607,
      "hand-of-order-potion-1-actual-labour-4": 608,
      "hand-of-order-potion-1-actual-labour-5": 609,
      "step-610-action": 610,
      "actual-week-finance-settlement-5": 610,
      "step-611-action": 611,
      "step-612-action": 612,
      "step-613-action": 613,
      "actual-week-finance-settlement-6": 613,
      "step-614-action": 614,
      "step-615-action": 615,
      "step-616-action": 616,
      "actual-week-finance-settlement-7": 616,
      "step-617-action": 617,
      "step-618-action": 618,
      "step-619-action": 619,
      "actual-week-finance-settlement-8": 619,
      "step-620-action": 620,
      "step-621-action": 621,
      "step-622-action": 622,
      "actual-week-finance-settlement-9": 622,
      "step-623-action": 623,
      "step-624-action": 624,
      "step-625-action": 625,
      "actual-week-finance-settlement-10": 625,
      "step-626-action": 626,
      "step-627-action": 627,
      "step-628-action": 628,
      "actual-week-finance-settlement-11": 628,
      "step-629-action": 629,
      "paid1200-hand-of-order-potion-1": 630,
      "step-631-action": 631,
      "step-632-action": 632,
      "actual-week-finance-settlement-12": 632,
      "step-633-action": 633,
      "paid180-current-week-prepare-hand-of-order-potion-1": 634,
      "consume-hand-of-order-potion-1": 635,
      "actual-potion-failure": 635,
      "hand-of-order-potion-2-actual-labour": 636,
      "actual-event-life-bill-01": 637,
      "actual-week-finance-settlement-13": 637,
      "actual-zero-ap-command": 637,
      "hand-of-order-potion-2-actual-labour-2": 638,
      "hand-of-order-potion-2-actual-labour-3": 639,
      "hand-of-order-potion-2-actual-labour-4": 640,
      "actual-event-life-bill-01-2": 641,
      "actual-week-finance-settlement-14": 641,
      "actual-zero-ap-command-2": 641,
      "hand-of-order-potion-2-actual-labour-5": 642,
      "step-643-action": 643,
      "step-644-action": 644,
      "actual-week-finance-settlement-15": 644,
      "step-645-action": 645,
      "step-646-action": 646,
      "step-647-action": 647,
      "actual-week-finance-settlement-16": 647,
      "step-648-action": 648,
      "step-649-action": 649,
      "step-650-action": 650,
      "actual-week-finance-settlement-17": 650,
      "step-651-action": 651,
      "step-652-action": 652,
      "step-653-action": 653,
      "actual-week-finance-settlement-18": 653,
      "step-654-action": 654,
      "step-655-action": 655,
      "step-656-action": 656,
      "actual-week-finance-settlement-19": 656,
      "step-657-action": 657,
      "step-658-action": 658,
      "step-659-action": 659,
      "actual-week-finance-settlement-20": 659,
      "step-660-action": 660,
      "step-661-action": 661,
      "step-662-action": 662,
      "actual-week-finance-settlement-21": 662,
      "step-663-action": 663,
      "step-664-action": 664,
      "step-665-action": 665,
      "actual-week-finance-settlement-22": 665,
      "step-666-action": 666,
      "paid1200-hand-of-order-potion-2": 667,
      "step-668-action": 668,
      "step-669-action": 669,
      "actual-week-finance-settlement-23": 669,
      "step-670-action": 670,
      "paid180-current-week-prepare-hand-of-order-potion-2": 671,
      "consume-hand-of-order-potion-2": 672,
      "actual-potion-failure-2": 672,
      "hand-of-order-potion-3-actual-labour": 673,
      "actual-week-finance-settlement-24": 673,
      "hand-of-order-potion-3-actual-labour-2": 674,
      "hand-of-order-potion-3-actual-labour-3": 675,
      "hand-of-order-potion-3-actual-labour-4": 676,
      "actual-week-finance-settlement-25": 676,
      "hand-of-order-potion-3-actual-labour-5": 677,
      "step-678-action": 678,
      "step-679-action": 679,
      "actual-week-finance-settlement-26": 679,
      "step-680-action": 680,
      "step-681-action": 681,
      "step-682-action": 682,
      "actual-week-finance-settlement-27": 682,
      "step-683-action": 683,
      "step-684-action": 684,
      "step-685-action": 685,
      "actual-week-finance-settlement-28": 685,
      "step-686-action": 686,
      "step-687-action": 687,
      "step-688-action": 688,
      "actual-week-finance-settlement-29": 688,
      "step-689-action": 689,
      "step-690-action": 690,
      "step-691-action": 691,
      "actual-week-finance-settlement-30": 691,
      "step-692-action": 692,
      "step-693-action": 693,
      "step-694-action": 694,
      "actual-week-finance-settlement-31": 694,
      "step-695-action": 695,
      "step-696-action": 696,
      "step-697-action": 697,
      "actual-week-finance-settlement-32": 697,
      "step-698-action": 698,
      "paid1200-hand-of-order-potion-3": 699,
      "step-700-action": 700,
      "step-701-action": 701,
      "actual-week-finance-settlement-33": 701,
      "step-702-action": 702,
      "paid180-current-week-prepare-hand-of-order-potion-3": 703,
      "consume-hand-of-order-potion-3": 704,
      "actual-potion-failure-3": 704,
      "step-705-action": 705,
      "actual-week-finance-settlement-34": 705,
      "step-706-action": 706,
      "paid100-after-all-original-bottles-failed": 707,
      "step-708-action": 708,
      "actual-week-finance-settlement-35": 708,
      "next-real-week-three-new-bottle-identities": 709,
      "hand-of-order-potion-4-actual-labour": 710,
      "hand-of-order-potion-4-actual-labour-2": 711,
      "hand-of-order-potion-4-actual-labour-3": 712,
      "actual-week-finance-settlement-36": 712,
      "hand-of-order-potion-4-actual-labour-4": 713,
      "hand-of-order-potion-4-actual-labour-5": 714,
      "step-715-action": 715,
      "actual-week-finance-settlement-37": 715,
      "step-716-action": 716,
      "step-717-action": 717,
      "step-718-action": 718,
      "actual-week-finance-settlement-38": 718,
      "step-719-action": 719,
      "step-720-action": 720,
      "step-721-action": 721,
      "actual-week-finance-settlement-39": 721,
      "step-722-action": 722,
      "step-723-action": 723,
      "step-724-action": 724,
      "actual-week-finance-settlement-40": 724,
      "step-725-action": 725,
      "step-726-action": 726,
      "step-727-action": 727,
      "actual-week-finance-settlement-41": 727,
      "step-728-action": 728,
      "step-729-action": 729,
      "step-730-action": 730,
      "actual-week-finance-settlement-42": 730,
      "step-731-action": 731,
      "step-732-action": 732,
      "step-733-action": 733,
      "actual-week-finance-settlement-43": 733,
      "step-734-action": 734,
      "paid1200-hand-of-order-potion-4": 735,
      "step-736-action": 736,
      "step-737-action": 737,
      "actual-week-finance-settlement-44": 737,
      "step-738-action": 738,
      "paid180-current-week-prepare-hand-of-order-potion-4": 739,
      "consume-hand-of-order-potion-4": 740,
      "promotion": 740,
      "walk-four-metres-to-actual-outside": 741,
      "actual-four-metre-original-room-exit": 741,
      "step-742-action": 742,
      "actual-week-finance-settlement-45": 742,
      "step-743-action": 743,
      "pay40-place-new-annex-with-three-finite-pieces": 744,
      "actual-paid-annex-placed": 744,
      "step-745-action": 745,
      "actual-week-finance-settlement-46": 745,
      "paired-handover-observe-originals-and-new-annex": 746,
      "paired-handover-prepare": 747,
      "paired-handover-walk": 748,
      "paired-handover-check_originals": 749,
      "paired-handover-consent_mira": 750,
      "paired-handover-setup_objects": 751,
      "paired-handover-battlefield_division": 752,
      "paired-handover-division-actual-window": 752,
      "paired-handover-actual-paid-piece-consumption": 752,
      "paired-handover-attempt_handover": 753,
      "paired-handover-actual-crossing-stopped": 753,
      "paired-handover-complete_handover": 754,
      "paired-handover-actual-ordinary-handover": 754,
      "paired-handover-walk-2": 755,
      "paired-handover-take_object": 756,
      "paired-handover-walk-3": 757,
      "paired-handover-return_objects": 758,
      "paired-handover-walk-4": 759,
      "paired-handover-inspect": 760,
      "paired-handover-leave": 761,
      "paired-handover-ordinary-closure-ability": 761,
      "paired-handover-honest-report": 762,
      "actual-week-finance-settlement-47": 762,
      "measured-aftermath-observe-originals-and-new-annex": 763,
      "measured-aftermath-prepare": 764,
      "measured-aftermath-walk": 765,
      "measured-aftermath-check_originals": 766,
      "measured-aftermath-consent_mira": 767,
      "measured-aftermath-setup_objects": 768,
      "measured-aftermath-aftermath_control": 769,
      "measured-aftermath-aftermath-actual-failed-window": 769,
      "measured-aftermath-actual-paid-piece-consumption": 769,
      "measured-aftermath-ordinary_brace": 770,
      "measured-aftermath-actual-impulse-ordinary_brace": 770,
      "measured-aftermath-return_objects": 771,
      "measured-aftermath-walk-2": 772,
      "measured-aftermath-inspect": 773,
      "measured-aftermath-leave": 774,
      "measured-aftermath-ordinary-closure-ordinary": 774,
      "measured-aftermath-honest-report": 775,
      "actual-week-finance-settlement-48": 775,
      "withdrawn-boundary-observe-originals-and-new-annex": 776,
      "withdrawn-boundary-prepare": 777,
      "withdrawn-boundary-walk": 778,
      "withdrawn-boundary-check_originals": 779,
      "withdrawn-boundary-consent_mira": 780,
      "withdrawn-boundary-setup_objects": 781,
      "withdrawn-boundary-battlefield_division": 782,
      "withdrawn-boundary-division-actual-failed-window": 782,
      "withdrawn-boundary-actual-paid-piece-consumption": 782,
      "withdrawn-boundary-withdraw_permission": 783,
      "withdrawn-boundary-fresh-permission-withdrawn-before-pending-action": 783,
      "withdrawn-boundary-complete_handover": 784,
      "withdrawn-boundary-actual-ordinary-handover": 784,
      "withdrawn-boundary-walk-2": 785,
      "withdrawn-boundary-take_object": 786,
      "withdrawn-boundary-walk-3": 787,
      "withdrawn-boundary-return_objects": 788,
      "withdrawn-boundary-walk-4": 789,
      "withdrawn-boundary-inspect": 790,
      "withdrawn-boundary-leave": 791,
      "withdrawn-boundary-ordinary-closure-ordinary": 791,
      "withdrawn-boundary-honest-report": 792,
      "actual-week-finance-settlement-49": 792,
      "three-honest-reports-reflected": 793,
      "step-794-action": 794,
      "step-795-action": 795,
      "actual-week-finance-settlement-50": 795,
      "paid30-three-independent-combat-support-pieces": 796,
      "original-adults-remain-outside-player-walks-to-new-yard": 797,
      "independent-optional-bram-fight": 798,
      "combat-round-1": 799,
      "combat-round-2": 800,
      "combat-round-3": 801,
      "actual-sealed-player-death": 801
    },
    "provenance": {
      "kind": "EXACT594_PUBLIC_BALANCER_THEN_PUBLIC_HAND_OF_ORDER",
      "prior": {
        "kind": "SAME_SEED_ORIGINAL_LIVING_BRANCH_PUBLIC_CONTINUATION",
        "source": "tests/fixtures/recovery-v01620/natural.json",
        "sourceSha256": "3589c7d792bc5974dc79452a9d9f10ae68832da565e97ad88f06f61915f07942",
        "newRandomChanges": false
      },
      "source": "tests/fixtures/balancer-v01840/natural.json",
      "sourceSha256": "e9437ca076c8f9779f8586970308b03032d4b67a13b0588809966818bda264e1",
      "sourceRoot": "final",
      "inheritedDirectedPrefix": false,
      "fullNaturalS9ToS1": true,
      "newRandomChanges": false
    },
    "strategy": {
      "source": "EXACT594_FULL_LIVING_BALANCER_FINAL",
      "sourceSeed": "arbiter-natural-v066",
      "sourceCursor": 367,
      "caseMethod": "ABILITY",
      "caseRoute": "CURRENT_PUBLIC_PREFERRED_ACTION_ONCE_EACH_WITH_ORDINARY_COMPLETION_IF_POWER_FAILS",
      "encounterPolicy": "ALL",
      "combatStance": "CONTROL",
      "combatRoundCap": 90,
      "potionAttemptCap": 12,
      "maxCommands": 3500,
      "ordinaryPreparationCap": 600,
      "caseCommandCap": 80,
      "sourceInjuryRecovery": "CHECK_ACTUAL_CARE_KNOWN_THEN_REAL_REST_PAY60_AND_REST_UNTIL_ORIGINAL_WOUNDS_CLEAR_AND_HEALTH100",
      "sourceRecoveryRestCap": 16,
      "ordinaryActions": "WORK_ONCE_PER_WEEK_THEN_REST_EXCEPT_SOURCE_WOUND_RECOVERY_REST",
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
      "afterCases": "NO_OPTIONAL_MAXIMUM_RECOVERY_STOP_AFTER_ACTUAL_LIVING_EXIT_AND_DUE_SETTLEMENT",
      "guardPlate": "SOLE_LIVE_CONTINUATION_OF_ORIGINAL_BA2_GUARD_PLATE_INTEGRITY65_NO_RESTORE",
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
      "revision": 595,
      "week": 135,
      "date": {
        "epoch": "FIFTH_EPOCH",
        "year": 1352,
        "month": 1,
        "day": 22
      },
      "H": 60,
      "M": 96,
      "S": 120,
      "cash": 690,
      "AP": 3,
      "pollution": 0,
      "injuries": [
        {
          "id": "arbiter-rebuild-natural:combat:1:PLAYER:590:0",
          "severity": "LIGHT",
          "acquiredRevision": 590,
          "treatedRevision": null
        },
        {
          "id": "arbiter-rebuild-natural:combat:4:PLAYER:593:1",
          "severity": "HEAVY",
          "acquiredRevision": 593,
          "treatedRevision": null
        }
      ],
      "injuryRisk": 1,
      "random": {
        "seed": "arbiter-natural-v066",
        "cursor": 367
      },
      "sequence": 2,
      "acting": 100,
      "mastery": {
        "justiciar.s9.authority": 0,
        "justiciar.s9.persuasive-charisma": 25,
        "justiciar.s9.combat-training": 56,
        "justiciar.s8.trace-sensing": 25,
        "justiciar.s8.image-reconstruction": 41,
        "justiciar.s7.mental-puncture": 49,
        "justiciar.s7.mental-pressure": 0,
        "justiciar.s6.authority": 16,
        "justiciar.s6.prohibition": 8,
        "justiciar.s5.punishment": 0,
        "justiciar.s5.confinement": 0,
        "justiciar.s5.wound-verdict": 0,
        "justiciar.s4.intimidation": 8,
        "justiciar.s4.deprivation": 8,
        "justiciar.s3.bounded-order": 8,
        "justiciar.s2.imbalance-sensing": 8,
        "justiciar.s2.measured-resistance": 0
      },
      "finance": {
        "weeklyBudget": 3,
        "wagePaidWeek": 134,
        "lifeTier": "DESTITUTE",
        "nextLifeTier": "DESTITUTE",
        "debts": [
          {
            "id": "debt-30-119-0",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 30
          },
          {
            "id": "debt-31-124-1",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 31
          },
          {
            "id": "debt-32-129-2",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 32
          },
          {
            "id": "debt-84-327-3",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 84
          },
          {
            "id": "debt-85-333-4",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 85
          },
          {
            "id": "debt-91-362-5",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 91
          },
          {
            "id": "debt-106-412-6",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 106
          },
          {
            "id": "debt-107-430-7",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 107
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
        "physique": 30,
        "perception": 25,
        "will": 25,
        "knowledge": 21
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
      "justiciar.s9.authority": 0,
      "justiciar.s9.persuasive-charisma": 25,
      "justiciar.s9.combat-training": 56,
      "justiciar.s8.trace-sensing": 25,
      "justiciar.s8.image-reconstruction": 41,
      "justiciar.s7.mental-puncture": 49,
      "justiciar.s7.mental-pressure": 0,
      "justiciar.s6.authority": 16,
      "justiciar.s6.prohibition": 8,
      "justiciar.s5.punishment": 0,
      "justiciar.s5.confinement": 0,
      "justiciar.s5.wound-verdict": 0,
      "justiciar.s4.intimidation": 8,
      "justiciar.s4.deprivation": 8,
      "justiciar.s3.bounded-order": 8,
      "justiciar.s2.imbalance-sensing": 8,
      "justiciar.s2.measured-resistance": 0
    },
    "final": {
      "status": "DEAD",
      "revision": 802,
      "week": 185,
      "date": {
        "epoch": "FIFTH_EPOCH",
        "year": 1353,
        "month": 1,
        "day": 6
      },
      "H": 0,
      "M": 88,
      "S": 100,
      "cash": 140,
      "AP": 1,
      "pollution": 0,
      "injuries": [
        {
          "id": "arbiter-rebuild-natural:combat:1:PLAYER:800:0",
          "severity": "LIGHT",
          "acquiredRevision": 800,
          "treatedRevision": null
        }
      ],
      "injuryRisk": 1,
      "random": {
        "seed": "arbiter-natural-v066",
        "cursor": 416
      },
      "sequence": 1,
      "acting": 100,
      "mastery": {
        "justiciar.s9.authority": 0,
        "justiciar.s9.persuasive-charisma": 25,
        "justiciar.s9.combat-training": 56,
        "justiciar.s8.trace-sensing": 25,
        "justiciar.s8.image-reconstruction": 41,
        "justiciar.s7.mental-puncture": 49,
        "justiciar.s7.mental-pressure": 0,
        "justiciar.s6.authority": 16,
        "justiciar.s6.prohibition": 8,
        "justiciar.s5.punishment": 0,
        "justiciar.s5.confinement": 0,
        "justiciar.s5.wound-verdict": 0,
        "justiciar.s4.intimidation": 8,
        "justiciar.s4.deprivation": 8,
        "justiciar.s3.bounded-order": 8,
        "justiciar.s2.imbalance-sensing": 8,
        "justiciar.s2.measured-resistance": 0,
        "justiciar.s1.battlefield-division": 8,
        "justiciar.s1.aftermath-control": 0
      },
      "finance": {
        "weeklyBudget": 3,
        "wagePaidWeek": 184,
        "lifeTier": "DESTITUTE",
        "nextLifeTier": "DESTITUTE",
        "debts": [
          {
            "id": "debt-30-119-0",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 30
          },
          {
            "id": "debt-31-124-1",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 31
          },
          {
            "id": "debt-32-129-2",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 32
          },
          {
            "id": "debt-84-327-3",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 84
          },
          {
            "id": "debt-85-333-4",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 85
          },
          {
            "id": "debt-91-362-5",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 91
          },
          {
            "id": "debt-106-412-6",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 106
          },
          {
            "id": "debt-107-430-7",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 107
          },
          {
            "id": "debt-147-638-8",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 147
          },
          {
            "id": "debt-148-642-9",
            "source": "生活应付款",
            "remaining": 0,
            "weeklyPayment": 30,
            "createdWeek": 148
          }
        ],
        "missedWeeks": 0,
        "credit": "NORMAL",
        "pulse": "NONE",
        "billAmount": 0
      }
    },
    "finalRawStateSha256": "0bc2809044dec6ed8af2538f460e29d6fcf8d6c356144c792bc83b203e0fa241",
    "promotionWeek": 179,
    "treatments": [
      {
        "paidPennies": 60,
        "before": {
          "status": "ACTIVE",
          "revision": 596,
          "week": 135,
          "date": {
            "epoch": "FIFTH_EPOCH",
            "year": 1352,
            "month": 1,
            "day": 22
          },
          "H": 68,
          "M": 100,
          "S": 120,
          "cash": 690,
          "AP": 2,
          "pollution": 0,
          "injuries": [
            {
              "id": "arbiter-rebuild-natural:combat:1:PLAYER:590:0",
              "severity": "LIGHT",
              "acquiredRevision": 590,
              "treatedRevision": null
            },
            {
              "id": "arbiter-rebuild-natural:combat:4:PLAYER:593:1",
              "severity": "HEAVY",
              "acquiredRevision": 593,
              "treatedRevision": null
            }
          ],
          "injuryRisk": 1,
          "random": {
            "seed": "arbiter-natural-v066",
            "cursor": 367
          },
          "sequence": 2,
          "acting": 100,
          "mastery": {
            "justiciar.s9.authority": 0,
            "justiciar.s9.persuasive-charisma": 25,
            "justiciar.s9.combat-training": 56,
            "justiciar.s8.trace-sensing": 25,
            "justiciar.s8.image-reconstruction": 41,
            "justiciar.s7.mental-puncture": 49,
            "justiciar.s7.mental-pressure": 0,
            "justiciar.s6.authority": 16,
            "justiciar.s6.prohibition": 8,
            "justiciar.s5.punishment": 0,
            "justiciar.s5.confinement": 0,
            "justiciar.s5.wound-verdict": 0,
            "justiciar.s4.intimidation": 8,
            "justiciar.s4.deprivation": 8,
            "justiciar.s3.bounded-order": 8,
            "justiciar.s2.imbalance-sensing": 8,
            "justiciar.s2.measured-resistance": 0
          },
          "finance": {
            "weeklyBudget": 3,
            "wagePaidWeek": 134,
            "lifeTier": "DESTITUTE",
            "nextLifeTier": "DESTITUTE",
            "debts": [
              {
                "id": "debt-30-119-0",
                "source": "生活应付款",
                "remaining": 0,
                "weeklyPayment": 30,
                "createdWeek": 30
              },
              {
                "id": "debt-31-124-1",
                "source": "生活应付款",
                "remaining": 0,
                "weeklyPayment": 30,
                "createdWeek": 31
              },
              {
                "id": "debt-32-129-2",
                "source": "生活应付款",
                "remaining": 0,
                "weeklyPayment": 30,
                "createdWeek": 32
              },
              {
                "id": "debt-84-327-3",
                "source": "生活应付款",
                "remaining": 0,
                "weeklyPayment": 30,
                "createdWeek": 84
              },
              {
                "id": "debt-85-333-4",
                "source": "生活应付款",
                "remaining": 0,
                "weeklyPayment": 30,
                "createdWeek": 85
              },
              {
                "id": "debt-91-362-5",
                "source": "生活应付款",
                "remaining": 0,
                "weeklyPayment": 30,
                "createdWeek": 91
              },
              {
                "id": "debt-106-412-6",
                "source": "生活应付款",
                "remaining": 0,
                "weeklyPayment": 30,
                "createdWeek": 106
              },
              {
                "id": "debt-107-430-7",
                "source": "生活应付款",
                "remaining": 0,
                "weeklyPayment": 30,
                "createdWeek": 107
              }
            ],
            "missedWeeks": 0,
            "credit": "NORMAL",
            "pulse": "NONE",
            "billAmount": 0
          }
        },
        "after": {
          "status": "ACTIVE",
          "revision": 597,
          "week": 135,
          "date": {
            "epoch": "FIFTH_EPOCH",
            "year": 1352,
            "month": 1,
            "day": 22
          },
          "H": 68,
          "M": 100,
          "S": 120,
          "cash": 630,
          "AP": 2,
          "pollution": 0,
          "injuries": [
            {
              "id": "arbiter-rebuild-natural:combat:1:PLAYER:590:0",
              "severity": "LIGHT",
              "acquiredRevision": 590,
              "treatedRevision": null
            },
            {
              "id": "arbiter-rebuild-natural:combat:4:PLAYER:593:1",
              "severity": "HEAVY",
              "acquiredRevision": 593,
              "treatedRevision": 597
            }
          ],
          "injuryRisk": 1,
          "random": {
            "seed": "arbiter-natural-v066",
            "cursor": 367
          },
          "sequence": 2,
          "acting": 100,
          "mastery": {
            "justiciar.s9.authority": 0,
            "justiciar.s9.persuasive-charisma": 25,
            "justiciar.s9.combat-training": 56,
            "justiciar.s8.trace-sensing": 25,
            "justiciar.s8.image-reconstruction": 41,
            "justiciar.s7.mental-puncture": 49,
            "justiciar.s7.mental-pressure": 0,
            "justiciar.s6.authority": 16,
            "justiciar.s6.prohibition": 8,
            "justiciar.s5.punishment": 0,
            "justiciar.s5.confinement": 0,
            "justiciar.s5.wound-verdict": 0,
            "justiciar.s4.intimidation": 8,
            "justiciar.s4.deprivation": 8,
            "justiciar.s3.bounded-order": 8,
            "justiciar.s2.imbalance-sensing": 8,
            "justiciar.s2.measured-resistance": 0
          },
          "finance": {
            "weeklyBudget": 3,
            "wagePaidWeek": 134,
            "lifeTier": "DESTITUTE",
            "nextLifeTier": "DESTITUTE",
            "debts": [
              {
                "id": "debt-30-119-0",
                "source": "生活应付款",
                "remaining": 0,
                "weeklyPayment": 30,
                "createdWeek": 30
              },
              {
                "id": "debt-31-124-1",
                "source": "生活应付款",
                "remaining": 0,
                "weeklyPayment": 30,
                "createdWeek": 31
              },
              {
                "id": "debt-32-129-2",
                "source": "生活应付款",
                "remaining": 0,
                "weeklyPayment": 30,
                "createdWeek": 32
              },
              {
                "id": "debt-84-327-3",
                "source": "生活应付款",
                "remaining": 0,
                "weeklyPayment": 30,
                "createdWeek": 84
              },
              {
                "id": "debt-85-333-4",
                "source": "生活应付款",
                "remaining": 0,
                "weeklyPayment": 30,
                "createdWeek": 85
              },
              {
                "id": "debt-91-362-5",
                "source": "生活应付款",
                "remaining": 0,
                "weeklyPayment": 30,
                "createdWeek": 91
              },
              {
                "id": "debt-106-412-6",
                "source": "生活应付款",
                "remaining": 0,
                "weeklyPayment": 30,
                "createdWeek": 106
              },
              {
                "id": "debt-107-430-7",
                "source": "生活应付款",
                "remaining": 0,
                "weeklyPayment": 30,
                "createdWeek": 107
              }
            ],
            "missedWeeks": 0,
            "credit": "NORMAL",
            "pulse": "NONE",
            "billAmount": 0
          }
        }
      }
    ],
    "bottles": [
      {
        "id": "hand-of-order-potion-1",
        "source": "薇娜·贝尔介绍的专业交接处的独立秩序之手成品渠道第1批、第136周实际登记的第1瓶序列1成品，独立封存编号hand-of-order-potion-1；本瓶独立劳动、交付与耗用，不补回旧瓶。",
        "stockedWeek": 136,
        "labourSteps": 5,
        "acquiredWeek": 146,
        "consumedWeek": 147,
        "preparationWeek": 147,
        "status": "CONSUMED",
        "outcome": "FAILURE"
      },
      {
        "id": "hand-of-order-potion-2",
        "source": "薇娜·贝尔介绍的专业交接处的独立秩序之手成品渠道第1批、第136周实际登记的第2瓶序列1成品，独立封存编号hand-of-order-potion-2；本瓶独立劳动、交付与耗用，不补回旧瓶。",
        "stockedWeek": 136,
        "labourSteps": 5,
        "acquiredWeek": 157,
        "consumedWeek": 158,
        "preparationWeek": 158,
        "status": "CONSUMED",
        "outcome": "FAILURE"
      },
      {
        "id": "hand-of-order-potion-3",
        "source": "薇娜·贝尔介绍的专业交接处的独立秩序之手成品渠道第1批、第136周实际登记的第3瓶序列1成品，独立封存编号hand-of-order-potion-3；本瓶独立劳动、交付与耗用，不补回旧瓶。",
        "stockedWeek": 136,
        "labourSteps": 5,
        "acquiredWeek": 167,
        "consumedWeek": 168,
        "preparationWeek": 168,
        "status": "CONSUMED",
        "outcome": "FAILURE"
      },
      {
        "id": "hand-of-order-potion-4",
        "source": "薇娜·贝尔介绍的专业交接处的独立秩序之手成品渠道第2批、第170周实际登记的第4瓶序列1成品，独立封存编号hand-of-order-potion-4；本瓶独立劳动、交付与耗用，不补回旧瓶。",
        "stockedWeek": 170,
        "labourSteps": 5,
        "acquiredWeek": 178,
        "consumedWeek": 179,
        "preparationWeek": 179,
        "status": "CONSUMED",
        "outcome": "SUCCESS"
      },
      {
        "id": "hand-of-order-potion-5",
        "source": "薇娜·贝尔介绍的专业交接处的独立秩序之手成品渠道第2批、第170周实际登记的第5瓶序列1成品，独立封存编号hand-of-order-potion-5；本瓶独立劳动、交付与耗用，不补回旧瓶。",
        "stockedWeek": 170,
        "labourSteps": 0,
        "acquiredWeek": null,
        "consumedWeek": null,
        "preparationWeek": null,
        "status": "SUPPLIER",
        "outcome": null
      },
      {
        "id": "hand-of-order-potion-6",
        "source": "薇娜·贝尔介绍的专业交接处的独立秩序之手成品渠道第2批、第170周实际登记的第6瓶序列1成品，独立封存编号hand-of-order-potion-6；本瓶独立劳动、交付与耗用，不补回旧瓶。",
        "stockedWeek": 170,
        "labourSteps": 0,
        "acquiredWeek": null,
        "consumedWeek": null,
        "preparationWeek": null,
        "status": "SUPPLIER",
        "outcome": null
      }
    ],
    "lifeAbilityUse": {
      "justiciar.s1.battlefield-division": {
        "paidAttempts": 2,
        "castingSuccesses": 1,
        "actualApplications": 1,
        "reportedApplications": 1,
        "spiritualitySpent": 16,
        "mindSpent": 6
      },
      "justiciar.s1.aftermath-control": {
        "paidAttempts": 1,
        "castingSuccesses": 0,
        "actualApplications": 0,
        "reportedApplications": 0,
        "spiritualitySpent": 8,
        "mindSpent": 4
      }
    },
    "combatAbilityUse": {
      "justiciar.s1.battlefield-division": {
        "selectedSlots": 4,
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
      },
      "justiciar.s1.aftermath-control": {
        "selectedSlots": 4,
        "paidAttempts": 2,
        "castingSuccesses": 1,
        "unresistedSuccesses": 1,
        "resistedAttempts": 0,
        "preparedWindows": 1,
        "actualApplications": 0,
        "contributionChange": 0,
        "masteryApplications": 0,
        "spiritualitySpent": 16,
        "mindSpent": 6,
        "supportWearPaid": 2
      }
    },
    "completedCases": [
      "paired-handover",
      "measured-aftermath",
      "withdrawn-boundary"
    ],
    "combatRounds": [
      1,
      2,
      3
    ],
    "consequenceDomains": [
      "BODY",
      null
    ],
    "terminal": {
      "outcome": "PLAYER_DEAD",
      "round": 3,
      "historyIndex": 29,
      "enemyHealth": 100,
      "enemyMind": 100,
      "enemySpirituality": 71,
      "enemyStatus": "RESISTING",
      "exitMetres": 0,
      "exitSeconds": 0
    },
    "sqliteRepresentatives": [
      "exact-original594-living-source",
      "actual-event-life-care-01",
      "paid500-guidance-freezes-eight-roots-and-original-guard-plate",
      "paid1200-hand-of-order-potion-1",
      "paid1200-hand-of-order-potion-2",
      "paid1200-hand-of-order-potion-3",
      "paid1200-hand-of-order-potion-4",
      "consume-hand-of-order-potion-1",
      "consume-hand-of-order-potion-2",
      "consume-hand-of-order-potion-3",
      "consume-hand-of-order-potion-4",
      "paid100-after-all-original-bottles-failed",
      "next-real-week-three-new-bottle-identities",
      "walk-four-metres-to-actual-outside",
      "pay40-place-new-annex-with-three-finite-pieces",
      "paired-handover-prepare",
      "paired-handover-battlefield_division",
      "paired-handover-attempt_handover",
      "measured-aftermath-aftermath_control",
      "measured-aftermath-ordinary_brace",
      "withdrawn-boundary-withdraw_permission",
      "withdrawn-boundary-complete_handover",
      "paired-handover-return_objects",
      "paired-handover-leave",
      "paired-handover-honest-report",
      "three-honest-reports-reflected",
      "paid30-three-independent-combat-support-pieces",
      "original-adults-remain-outside-player-walks-to-new-yard",
      "independent-optional-bram-fight",
      "combat-round-1",
      "combat-round-2",
      "combat-round-3"
    ]
  }
};
