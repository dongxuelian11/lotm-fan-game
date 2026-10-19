import type { UncleanMonarchCaseId } from '../../src/domain/unclean-monarch/life.js';
import type { UncleanMonarchAbilityId } from '../../src/domain/unclean-monarch/types.js';

export interface LifeAbilityObservation {
  attempts: number; checkSuccesses: number; actualApplications: number; reportedApplications: number;
}
export interface CombatAbilityObservation {
  selectedSlots: number; paidAttempts: number; castingSuccesses: number; preparedWindows: number;
  actualApplications: number; masteryApplications: number; spiritualitySpent: number; mindSpent: number;
}
export const UNCLEAN_MONARCH_METADATA_FILES = ['natural.json', 'source-prefix.json', 'commands.jsonl', 'public.jsonl',
  'boundaries.index.json', 'boundaries.steps.json', 'transitions.json', 'summary.json', 'capture-integrity.json'] as const;
export interface UncleanMonarchObservedCapture {
  /** Fill only after the one coordinator-run original-seed capture has stopped. */
  observedAt: string; producerSha256: string;
  metadataHashes: Record<typeof UNCLEAN_MONARCH_METADATA_FILES[number], string>;
  files: number; commands: number; namedBoundaries: number; uniqueTransitions: number; aliases: number;
  stage: string; error: string | null; failurePhase: string; pendingIntent: unknown;
  snapshots: string[]; boundarySteps: Record<string, number>;
  provenance: unknown; continuation: unknown; strategy: unknown;
  originalBody: unknown; originalCharacter: unknown; originalMastery: Record<string, number>; final: unknown;
  promotionWeek: number | null; treatments: unknown[];
  lifeAbilityUse: Record<UncleanMonarchAbilityId, LifeAbilityObservation>;
  combatAbilityUse: Record<UncleanMonarchAbilityId, CombatAbilityObservation>;
  completedCases: UncleanMonarchCaseId[]; combatRounds: number[];
  consequenceDomains: ('BODY' | 'MENTAL')[]; terminal: unknown;
}

// Historical hashes remain pinned independently. The observations below were
// extracted after the coordinator completed the one original-seed capture.
// No reducer, migration, game, or test was executed by the extractor. These
// values describe actual results; they did not select or rerun any outcome.
// Both actual round consequence domains are BODY; no MENTAL result is invented.
export const UNCLEAN_MONARCH_CAPTURE_EVIDENCE: {
  sourceSha256: string; sourceBoundarySha256: string; priorSha256: string; prefixSha256: string;
  observed: UncleanMonarchObservedCapture | null;
} = {
  sourceSha256: '7762560089c03487c1dd4432fd367998d4874c165e3cce8d012d200d56222363',
  sourceBoundarySha256: 'c9c82f892d21d1cf68d955d75220da06334a9bea7e99b106f41c83e06e152e2c',
  priorSha256: '796a7efabb26d5db70a24eeb509d7bbe2d80aa33e864f2ff45eba65016abaf7b',
  prefixSha256: '6f57b3aafe3469b3293ee5c2e6b700b834cebab7f091faa1468a096ec3291da7',
  observed: {
  "observedAt": "2026-10-16T05:11:16.137Z",
  "producerSha256": "14251f9514ca7900e791b206068aaefc8f21378899ea9e9110f06a2de3e16f20",
  "metadataHashes": {
    "natural.json": "44f863ff2286be6aff77275d5c8455b2641680214d5b879e285d9d976b6d3ada",
    "source-prefix.json": "4988db8c77420deb9a680045227b649bfe745d92b3faf2ca06790d769a534ceb",
    "commands.jsonl": "50c50dae0b76f4de02182a76d57107fed3822cf842008b32c95a16ab8a694466",
    "public.jsonl": "6986e63bccd501362b5bb1fc919f663e52d94e3a972940c39b461e04a8afc1d4",
    "boundaries.index.json": "fa3ea0c3d0f336598c21751ded3b7a45005b092a92db3d62bbff492edd009067",
    "boundaries.steps.json": "5f46986a1be4b51815e82de14dbe8edd9a9373a4cb06fef5ff2340257c73d9ee",
    "transitions.json": "a8922045e891b534c82068f711af4506690213ccc87710fad4270b58cfe52113",
    "summary.json": "b4a2a47678689e72d0fa71ae5c1fae8758d122e73efeab6bd290556dea8c2512",
    "capture-integrity.json": "b4130dd6827fa56cc21a818604693f886624211dadf768dc8d3c95422e64ddda"
  },
  "files": 119,
  "commands": 821,
  "namedBoundaries": 106,
  "uniqueTransitions": 104,
  "aliases": 2,
  "stage": "NATURAL718_PREFIX_PUBLIC_UNCLEAN_MONARCH_CONTINUATION",
  "error": null,
  "failurePhase": "IDLE",
  "pendingIntent": null,
  "snapshots": [
    "departure",
    "sourceHealthy",
    "guidance",
    "promoted",
    "practiced",
    "actualBeforeEncounter",
    "combatStart",
    "combatTerminal"
  ],
  "boundarySteps": {
    "exact-original718-living-source": 718,
    "paid500-guidance-freezes-eight-roots": 719,
    "preparation-VERIFY_ORIGINALS": 720,
    "preparation-CHECK_LIMITS": 721,
    "preparation-CHECK_RETURN": 722,
    "unclean-monarch-potion-1-real-labour": 723,
    "unclean-monarch-potion-1-real-labour-2": 724,
    "unclean-monarch-potion-1-real-labour-3": 725,
    "unclean-monarch-potion-1-real-labour-4": 726,
    "unclean-monarch-potion-1-real-labour-5": 727,
    "step-728-action": 728,
    "step-729-action": 729,
    "step-730-action": 730,
    "step-731-action": 731,
    "step-732-action": 732,
    "step-733-action": 733,
    "step-734-action": 734,
    "step-735-action": 735,
    "step-736-action": 736,
    "step-737-action": 737,
    "step-738-action": 738,
    "step-739-action": 739,
    "step-740-action": 740,
    "step-741-action": 741,
    "step-742-action": 742,
    "step-743-action": 743,
    "step-744-action": 744,
    "step-745-action": 745,
    "step-746-action": 746,
    "step-747-action": 747,
    "step-748-action": 748,
    "step-749-action": 749,
    "step-750-action": 750,
    "step-751-action": 751,
    "step-752-action": 752,
    "actual1200p-buy-unclean-monarch-potion-1": 753,
    "actual180p-current-week-prepare-unclean-monarch-potion-1": 754,
    "consume-unclean-monarch-potion-1": 755,
    "promotion": 755,
    "step-756-action": 756,
    "measured-reading-observe-originals": 757,
    "measured-reading-consent": 758,
    "measured-reading-consent-2": 759,
    "measured-reading-prepare": 760,
    "measured-reading-walk_to_a": 761,
    "measured-reading-take_card": 762,
    "measured-reading-walk_to_b": 763,
    "measured-reading-read_original": 764,
    "measured-reading-notice_impulse": 765,
    "measured-reading-impulse_binding": 766,
    "measured-reading-check_original": 767,
    "measured-reading-return_to_a": 768,
    "measured-reading-return_card": 769,
    "measured-reading-return_to_entry": 770,
    "measured-reading-return_piece": 771,
    "measured-reading-leave": 772,
    "measured-reading-honest-report": 773,
    "observed-tension-observe-originals": 774,
    "observed-tension-consent": 775,
    "observed-tension-consent-2": 776,
    "observed-tension-prepare": 777,
    "observed-tension-walk_to_a": 778,
    "observed-tension-take_card": 779,
    "observed-tension-walk_to_b": 780,
    "observed-tension-read_original": 781,
    "observed-tension-rehearse_bell": 782,
    "observed-tension-confirm_emotion": 783,
    "observed-tension-focused_interference": 784,
    "observed-tension-perform_operation": 785,
    "observed-tension-return_to_a": 786,
    "observed-tension-return_card": 787,
    "observed-tension-return_to_entry": 788,
    "observed-tension-return_piece": 789,
    "observed-tension-leave": 790,
    "observed-tension-honest-report": 791,
    "step-792-event_choice": 792,
    "step-793-action": 793,
    "step-794-action": 794,
    "step-795-action": 795,
    "withdrawn-input-observe-originals": 796,
    "withdrawn-input-consent": 797,
    "withdrawn-input-consent-2": 798,
    "withdrawn-input-prepare": 799,
    "withdrawn-input-walk_to_a": 800,
    "withdrawn-input-take_card": 801,
    "withdrawn-input-walk_to_b": 802,
    "withdrawn-input-read_original": 803,
    "withdrawn-input-notice_impulse": 804,
    "withdrawn-input-impulse_binding": 805,
    "withdrawn-input-withdraw_consent": 806,
    "withdrawn-input-check_original": 807,
    "withdrawn-input-manual_operation": 808,
    "withdrawn-input-return_to_a": 809,
    "withdrawn-input-return_card": 810,
    "withdrawn-input-return_to_entry": 811,
    "withdrawn-input-return_piece": 812,
    "withdrawn-input-leave": 813,
    "withdrawn-input-honest-report": 814,
    "three-actual-honest-reports-reflected": 815,
    "paid-independent-combat-piece": 816,
    "actual-independent-harlan-contact": 817,
    "independent-optional-fight": 818,
    "combat-round-1": 819,
    "combat-round-2": 820,
    "actual-ordinary-encounter-exit": 820,
    "actual-work-after-living-exit": 821
  },
  "provenance": {
    "kind": "EXACT718_PUBLIC_BLOOD_DUKE_THEN_PUBLIC_UNCLEAN_MONARCH",
    "prior": {
      "kind": "SAME_SEED_PUBLIC_LIVING_FORK_BEFORE_OPTIONAL_COMBAT",
      "source": "tests/fixtures/blatherer-v01560/natural.json",
      "sourceSha256": "796a7efabb26d5db70a24eeb509d7bbe2d80aa33e864f2ff45eba65016abaf7b",
      "newRandomChanges": false
    },
    "source": "tests/fixtures/blood-duke-v01800/natural.json",
    "sourceSha256": "7762560089c03487c1dd4432fd367998d4874c165e3cce8d012d200d56222363",
    "sourceRoot": "beforeLast",
    "sourceBoundary": "tests/fixtures/blood-duke-v01800/boundary-real-combat-preparation.json",
    "sourceBoundarySha256": "c9c82f892d21d1cf68d955d75220da06334a9bea7e99b106f41c83e06e152e2c",
    "inheritedDirectedPrefix": false,
    "fullNaturalS9ToS1": true,
    "newRandomChanges": false,
    "preserved": [
      {
        "file": "tests/fixtures/blood-duke-v01800/natural.json",
        "sha256": "7762560089c03487c1dd4432fd367998d4874c165e3cce8d012d200d56222363",
        "commands": 724,
        "status": "DEAD"
      },
      {
        "file": "tests/fixtures/blatherer-v01560/natural.json",
        "sha256": "796a7efabb26d5db70a24eeb509d7bbe2d80aa33e864f2ff45eba65016abaf7b",
        "commands": 592,
        "status": "DEAD"
      }
    ]
  },
  "continuation": {
    "kind": "EXACT718_LIVING_PREFIX_THEN_PUBLIC_UNCLEAN_MONARCH",
    "sourceFixture": "tests/fixtures/blood-duke-v01800/natural.json",
    "sourceRoot": "beforeLast",
    "sourceBoundary": "tests/fixtures/blood-duke-v01800/boundary-real-combat-preparation.json",
    "sourceBoundarySha256": "c9c82f892d21d1cf68d955d75220da06334a9bea7e99b106f41c83e06e152e2c",
    "sourceS2Setup": "NATURAL_LIVING_PREFIX_OF_PRESERVED_DEATH",
    "newRandomChanges": false
  },
  "strategy": {
    "source": "EXACT718_LIVING_BLOOD_DUKE_BOUNDARY_BEFORE_LAST",
    "sourceSeed": "criminal-natural-v054",
    "sourceCursor": 112,
    "caseMethod": "ABILITY",
    "caseRoute": "CURRENT_PUBLIC_PREFERRED_ACTION_ONCE_EACH_WITH_ORDINARY_COMPLETION_IF_POWER_FAILS",
    "encounterPolicy": "ALL",
    "combatStance": "CONTROL",
    "combatRoundCap": 90,
    "potionAttemptCap": 12,
    "maxCommands": 3500,
    "ordinaryPreparationCap": 600,
    "sourceInjuryRecovery": "NONE_HEALTHY_ORIGINAL718",
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
      "mind": 4,
      "spirituality": 8
    },
    "encounterReadiness": {
      "ap": 2,
      "cash": 30
    },
    "afterCases": "NO_OPTIONAL_MAXIMUM_RECOVERY_ONE_PUBLIC_WORK_AFTER_LIVING_EXIT",
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
    "revision": 719,
    "week": 181,
    "date": {
      "epoch": "FIFTH_EPOCH",
      "year": 1352,
      "month": 12,
      "day": 9
    },
    "H": 100,
    "M": 100,
    "S": 120,
    "cash": 710,
    "AP": 3,
    "pollution": 0,
    "injuries": [],
    "injuryRisk": 0,
    "random": {
      "seed": "criminal-natural-v054",
      "cursor": 112
    },
    "mastery": {
      "abyss.s9.brute-force": 24,
      "abyss.s9.alertness": 32,
      "abyss.s9.illicit-insight": 41,
      "abyss.s8.inhuman-body": 41,
      "abyss.s7.demonic-lore": 0,
      "abyss.s7.ritual-practice": 0,
      "abyss.s6.danger-premonition": 0,
      "abyss.s6.demonic-body": 8,
      "abyss.s6.flame-hex": 33,
      "abyss.s5.emotion-seed": 25,
      "abyss.s5.catalysis": 0,
      "abyss.s4.desire-focus": 8,
      "abyss.s4.catalytic-pressure": 8,
      "abyss.s3.limited-murmur": 16,
      "abyss.s2.self-restraint": 8,
      "abyss.s2.emotion-interference": 8
    },
    "sequence": 2,
    "acting": 100,
    "finance": {
      "weeklyBudget": 3,
      "wagePaidWeek": 180,
      "lifeTier": "DESTITUTE",
      "nextLifeTier": "DESTITUTE",
      "debts": [
        {
          "id": "debt-23-87-0",
          "source": "生活应付款",
          "remaining": 0,
          "weeklyPayment": 30,
          "createdWeek": 23
        },
        {
          "id": "debt-24-91-1",
          "source": "生活应付款",
          "remaining": 0,
          "weeklyPayment": 30,
          "createdWeek": 24
        },
        {
          "id": "debt-42-165-2",
          "source": "生活应付款",
          "remaining": 0,
          "weeklyPayment": 30,
          "createdWeek": 42
        },
        {
          "id": "debt-51-197-3",
          "source": "生活应付款",
          "remaining": 0,
          "weeklyPayment": 30,
          "createdWeek": 51
        },
        {
          "id": "debt-101-364-4",
          "source": "生活应付款",
          "remaining": 0,
          "weeklyPayment": 30,
          "createdWeek": 101
        },
        {
          "id": "debt-102-368-5",
          "source": "生活应付款",
          "remaining": 0,
          "weeklyPayment": 30,
          "createdWeek": 102
        },
        {
          "id": "debt-103-372-6",
          "source": "生活应付款",
          "remaining": 0,
          "weeklyPayment": 30,
          "createdWeek": 103
        },
        {
          "id": "debt-117-424-7",
          "source": "生活应付款",
          "remaining": 0,
          "weeklyPayment": 30,
          "createdWeek": 117
        },
        {
          "id": "debt-146-519-8",
          "source": "生活应付款",
          "remaining": 0,
          "weeklyPayment": 30,
          "createdWeek": 146
        },
        {
          "id": "debt-147-537-9",
          "source": "生活应付款",
          "remaining": 0,
          "weeklyPayment": 30,
          "createdWeek": 147
        },
        {
          "id": "debt-154-588-10",
          "source": "生活应付款",
          "remaining": 0,
          "weeklyPayment": 30,
          "createdWeek": 154
        },
        {
          "id": "debt-155-592-11",
          "source": "生活应付款",
          "remaining": 0,
          "weeklyPayment": 30,
          "createdWeek": 155
        },
        {
          "id": "debt-156-596-12",
          "source": "生活应付款",
          "remaining": 0,
          "weeklyPayment": 30,
          "createdWeek": 156
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
      "perception": 24,
      "will": 22,
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
    "abyss.s9.brute-force": 24,
    "abyss.s9.alertness": 32,
    "abyss.s9.illicit-insight": 41,
    "abyss.s8.inhuman-body": 41,
    "abyss.s7.demonic-lore": 0,
    "abyss.s7.ritual-practice": 0,
    "abyss.s6.danger-premonition": 0,
    "abyss.s6.demonic-body": 8,
    "abyss.s6.flame-hex": 33,
    "abyss.s5.emotion-seed": 25,
    "abyss.s5.catalysis": 0,
    "abyss.s4.desire-focus": 8,
    "abyss.s4.catalytic-pressure": 8,
    "abyss.s3.limited-murmur": 16,
    "abyss.s2.self-restraint": 8,
    "abyss.s2.emotion-interference": 8
  },
  "final": {
    "status": "ACTIVE",
    "revision": 822,
    "week": 198,
    "date": {
      "epoch": "FIFTH_EPOCH",
      "year": 1353,
      "month": 4,
      "day": 7
    },
    "H": 100,
    "M": 92,
    "S": 110,
    "cash": 210,
    "AP": 2,
    "pollution": 0,
    "injuries": [],
    "injuryRisk": 0,
    "random": {
      "seed": "criminal-natural-v054",
      "cursor": 145
    },
    "mastery": {
      "abyss.s9.brute-force": 24,
      "abyss.s9.alertness": 32,
      "abyss.s9.illicit-insight": 41,
      "abyss.s8.inhuman-body": 41,
      "abyss.s7.demonic-lore": 0,
      "abyss.s7.ritual-practice": 0,
      "abyss.s6.danger-premonition": 0,
      "abyss.s6.demonic-body": 8,
      "abyss.s6.flame-hex": 33,
      "abyss.s5.emotion-seed": 25,
      "abyss.s5.catalysis": 0,
      "abyss.s4.desire-focus": 8,
      "abyss.s4.catalytic-pressure": 8,
      "abyss.s3.limited-murmur": 16,
      "abyss.s2.self-restraint": 8,
      "abyss.s2.emotion-interference": 8,
      "abyss.s1.impulse-binding": 16,
      "abyss.s1.focused-interference": 8
    },
    "sequence": 1,
    "acting": 100,
    "finance": {
      "weeklyBudget": 3,
      "wagePaidWeek": 198,
      "lifeTier": "DESTITUTE",
      "nextLifeTier": "DESTITUTE",
      "debts": [
        {
          "id": "debt-23-87-0",
          "source": "生活应付款",
          "remaining": 0,
          "weeklyPayment": 30,
          "createdWeek": 23
        },
        {
          "id": "debt-24-91-1",
          "source": "生活应付款",
          "remaining": 0,
          "weeklyPayment": 30,
          "createdWeek": 24
        },
        {
          "id": "debt-42-165-2",
          "source": "生活应付款",
          "remaining": 0,
          "weeklyPayment": 30,
          "createdWeek": 42
        },
        {
          "id": "debt-51-197-3",
          "source": "生活应付款",
          "remaining": 0,
          "weeklyPayment": 30,
          "createdWeek": 51
        },
        {
          "id": "debt-101-364-4",
          "source": "生活应付款",
          "remaining": 0,
          "weeklyPayment": 30,
          "createdWeek": 101
        },
        {
          "id": "debt-102-368-5",
          "source": "生活应付款",
          "remaining": 0,
          "weeklyPayment": 30,
          "createdWeek": 102
        },
        {
          "id": "debt-103-372-6",
          "source": "生活应付款",
          "remaining": 0,
          "weeklyPayment": 30,
          "createdWeek": 103
        },
        {
          "id": "debt-117-424-7",
          "source": "生活应付款",
          "remaining": 0,
          "weeklyPayment": 30,
          "createdWeek": 117
        },
        {
          "id": "debt-146-519-8",
          "source": "生活应付款",
          "remaining": 0,
          "weeklyPayment": 30,
          "createdWeek": 146
        },
        {
          "id": "debt-147-537-9",
          "source": "生活应付款",
          "remaining": 0,
          "weeklyPayment": 30,
          "createdWeek": 147
        },
        {
          "id": "debt-154-588-10",
          "source": "生活应付款",
          "remaining": 0,
          "weeklyPayment": 30,
          "createdWeek": 154
        },
        {
          "id": "debt-155-592-11",
          "source": "生活应付款",
          "remaining": 0,
          "weeklyPayment": 30,
          "createdWeek": 155
        },
        {
          "id": "debt-156-596-12",
          "source": "生活应付款",
          "remaining": 0,
          "weeklyPayment": 30,
          "createdWeek": 156
        },
        {
          "id": "debt-194-793-13",
          "source": "生活应付款",
          "remaining": 0,
          "weeklyPayment": 30,
          "createdWeek": 194
        }
      ],
      "missedWeeks": 0,
      "credit": "NORMAL",
      "pulse": "NONE",
      "billAmount": 0
    }
  },
  "promotionWeek": 192,
  "treatments": [],
  "lifeAbilityUse": {
    "abyss.s1.impulse-binding": {
      "attempts": 2,
      "checkSuccesses": 1,
      "actualApplications": 1,
      "reportedApplications": 1
    },
    "abyss.s1.focused-interference": {
      "attempts": 1,
      "checkSuccesses": 1,
      "actualApplications": 1,
      "reportedApplications": 1
    }
  },
  "combatAbilityUse": {
    "abyss.s1.impulse-binding": {
      "selectedSlots": 1,
      "paidAttempts": 1,
      "castingSuccesses": 1,
      "preparedWindows": 1,
      "actualApplications": 1,
      "masteryApplications": 1,
      "spiritualitySpent": 8,
      "mindSpent": 2
    },
    "abyss.s1.focused-interference": {
      "selectedSlots": 0,
      "paidAttempts": 0,
      "castingSuccesses": 0,
      "preparedWindows": 0,
      "actualApplications": 0,
      "masteryApplications": 0,
      "spiritualitySpent": 0,
      "mindSpent": 0
    }
  },
  "completedCases": [
    "measured-reading",
    "observed-tension",
    "withdrawn-input"
  ],
  "combatRounds": [
    1,
    2
  ],
  "consequenceDomains": [
    "BODY"
  ],
  "terminal": {
    "outcome": "ENEMY_DEAD",
    "round": 2,
    "historyIndex": 5,
    "enemyHealth": 0,
    "enemyMind": 100,
    "enemySpirituality": 106,
    "enemyStatus": "DEAD",
    "exitMetres": 4,
    "exitSeconds": 4
  }
},
};
