import type { AbominationCaseId } from '../../src/domain/abomination/life.js';
import type { AbominationAbilityId } from '../../src/domain/abomination/types.js';

export interface LifeAbilityObservation {
  attempts: number; checkSuccesses: number; actualApplications: number; reportedApplications: number;
}
export interface CombatAbilityObservation {
  selectedSlots: number; paidAttempts: number; castingSuccesses: number; preparedWindows: number;
  actualApplications: number; masteryApplications: number; spiritualitySpent: number; mindSpent: number;
}
export const ABOMINATION_METADATA_FILES = ['natural.json', 'source-prefix.json', 'commands.jsonl', 'public.jsonl',
  'boundaries.index.json', 'boundaries.steps.json', 'transitions.json', 'summary.json', 'capture-integrity.json'] as const;
export interface AbominationObservedCapture {
  /** Fill only after the one coordinator-run original-seed capture has stopped. */
  observedAt: string; producerSha256: string;
  metadataHashes: Record<typeof ABOMINATION_METADATA_FILES[number], string>;
  files: number; commands: number; namedBoundaries: number; uniqueTransitions: number; aliases: number;
  stage: string; error: string | null; failurePhase: string; pendingIntent: unknown;
  sqliteRepresentatives: string[];
  snapshots: string[]; boundarySteps: Record<string, number>;
  provenance: unknown; continuation: unknown; strategy: unknown;
  originalBody: unknown; originalCharacter: unknown; originalMastery: Record<string, number>; final: unknown;
  promotionWeek: number | null; treatments: unknown[];
  lifeAbilityUse: Record<AbominationAbilityId, LifeAbilityObservation>;
  combatAbilityUse: Record<AbominationAbilityId, CombatAbilityObservation>;
  completedCases: AbominationCaseId[]; combatRounds: number[];
  consequenceDomains: ('BODY' | 'MENTAL')[]; terminal: unknown;
}

// The source is the complete living642-command campaign. These literal
// observations were extracted only after the coordinator's original-seed run
// stopped. No reducer, migration, test or game was run by the extractor.
// One life barrier applied; no combat window applied. Failed casts and actual
// MENTAL/BODY consequences remain exactly as observed.
export const ABOMINATION_CAPTURE_EVIDENCE: {
  sourceSha256: string; priorSha256: string; prefixSha256: string;
  observed: AbominationObservedCapture | null;
} = {
  sourceSha256: 'f005b8f8aa0b9d82f14919fbf668a56c4f5a63e1284be94c6f7155b94472c96f',
  priorSha256: '04448ba6461db51279b9bdd6ed3736e76d1d9016067e04578ee7885ad8fdf1b9',
  prefixSha256: '60111cd86b8cc366ea7a7c5c51dd8d431e8d52c835391fcb2c60ab529ed859b8',
  observed: {
  "observedAt": "2026-10-16T06:45:43.984870Z",
  "producerSha256": "2c9353629c4dadc8b30c9e85282542b54c1fafd91e2275cc7557f3e4134462da",
  "metadataHashes": {
    "natural.json": "0d99439f4e950a633e20fdba372fb0e59beb41982ccff5fe6a27fd2834adf442",
    "source-prefix.json": "b3d38d32089a7482c3cf96b59046a0b5573d97799b075e03be17c71bac95a0f6",
    "commands.jsonl": "cbf25625234ec2415887efd9b122478b3784b7f00a007f2fe6cf518f718eecee",
    "public.jsonl": "8ff648fde7c3fc79d54e25c8a5b01bc2a50910f5935b2d0b8064ea79bd73a0fc",
    "boundaries.index.json": "d5bda7582336b324d07082734f39ceeea4399ae8b1e1ec5935080dfeed87d87e",
    "boundaries.steps.json": "70e4faeb73beea5122f8f90c390e32b3a17f304ffaa3c47ccfa50a49ee9edb68",
    "transitions.json": "d57481fb9052e7dd079722c3e3017f5b02995969df2ba3e12926bbd5cc5cf74c",
    "summary.json": "d66b411006cdcc589da08673f3041aa8d8f737c41eb2b58a0c1b126096e9ee53",
    "capture-integrity.json": "cd452ddf7bae96aeecdd59c793da0f8ca8ab27a0d2a3a4d2af3404e4317234e4"
  },
  "files": 152,
  "commands": 778,
  "namedBoundaries": 140,
  "uniqueTransitions": 137,
  "aliases": 3,
  "stage": "NATURAL642_PREFIX_PUBLIC_ABOMINATION_CONTINUATION",
  "error": null,
  "failurePhase": "IDLE",
  "pendingIntent": null,
  "sqliteRepresentatives": [
    "exact-original642-living-source",
    "paid500-guidance-freezes-eight-roots",
    "consume-abomination-potion-1",
    "consume-abomination-potion-2",
    "tray-pulse-invite",
    "tray-pulse-walk_to_a",
    "tray-pulse-spirit_barrier",
    "tray-pulse-perform_pulse",
    "tray-pulse-honest-report",
    "spoken-hesitation-brief_cry",
    "withdrawn-input-withdraw_consent",
    "paid-independent-combat-piece",
    "actual-roderick-contact-elsa-walks-out",
    "independent-optional-fight",
    "combat-round-1",
    "combat-round-2",
    "combat-round-4",
    "step-777-event_choice",
    "actual-work-after-living-exit"
  ],
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
    "exact-original642-living-source": 642,
    "paid500-guidance-freezes-eight-roots": 643,
    "preparation-VERIFY_ORIGINALS": 644,
    "preparation-CHECK_LIMITS": 645,
    "preparation-CHECK_RETURN": 646,
    "abomination-potion-1-real-labour": 647,
    "abomination-potion-1-real-labour-2": 648,
    "abomination-potion-1-real-labour-3": 649,
    "abomination-potion-1-real-labour-4": 650,
    "abomination-potion-1-real-labour-5": 651,
    "step-652-action": 652,
    "step-653-action": 653,
    "step-654-action": 654,
    "step-655-action": 655,
    "step-656-action": 656,
    "step-657-action": 657,
    "step-658-action": 658,
    "step-659-action": 659,
    "step-660-action": 660,
    "step-661-action": 661,
    "step-662-action": 662,
    "step-663-action": 663,
    "step-664-action": 664,
    "step-665-action": 665,
    "step-666-action": 666,
    "step-667-action": 667,
    "step-668-action": 668,
    "step-669-action": 669,
    "step-670-action": 670,
    "step-671-action": 671,
    "step-672-action": 672,
    "step-673-action": 673,
    "step-674-action": 674,
    "step-675-action": 675,
    "step-676-action": 676,
    "actual1200p-buy-abomination-potion-1": 677,
    "actual180p-current-week-prepare-abomination-potion-1": 678,
    "consume-abomination-potion-1": 679,
    "actual-potion-failure": 679,
    "abomination-potion-2-real-labour": 680,
    "abomination-potion-2-real-labour-2": 681,
    "abomination-potion-2-real-labour-3": 682,
    "abomination-potion-2-real-labour-4": 683,
    "abomination-potion-2-real-labour-5": 684,
    "step-685-action": 685,
    "step-686-action": 686,
    "step-687-action": 687,
    "step-688-action": 688,
    "step-689-action": 689,
    "step-690-action": 690,
    "step-691-action": 691,
    "step-692-action": 692,
    "step-693-action": 693,
    "step-694-action": 694,
    "step-695-action": 695,
    "step-696-action": 696,
    "step-697-action": 697,
    "step-698-action": 698,
    "step-699-action": 699,
    "step-700-action": 700,
    "step-701-action": 701,
    "step-702-action": 702,
    "step-703-action": 703,
    "step-704-action": 704,
    "step-705-action": 705,
    "step-706-action": 706,
    "step-707-action": 707,
    "step-708-action": 708,
    "actual1200p-buy-abomination-potion-2": 709,
    "actual180p-current-week-prepare-abomination-potion-2": 710,
    "consume-abomination-potion-2": 711,
    "promotion": 711,
    "step-712-action": 712,
    "tray-pulse-observe-originals": 713,
    "tray-pulse-consent": 714,
    "tray-pulse-consent-2": 715,
    "tray-pulse-invite": 716,
    "tray-pulse-prepare": 717,
    "tray-pulse-walk_to_a": 718,
    "tray-pulse-walk_to_b": 719,
    "tray-pulse-read_original": 720,
    "tray-pulse-return_to_a": 721,
    "tray-pulse-place_piece": 722,
    "tray-pulse-prepare_pulse": 723,
    "tray-pulse-spirit_barrier": 724,
    "tray-pulse-perform_pulse": 725,
    "tray-pulse-take_piece": 726,
    "tray-pulse-return_to_entry": 727,
    "tray-pulse-return_piece": 728,
    "tray-pulse-leave": 729,
    "tray-pulse-honest-report": 730,
    "step-731-action": 731,
    "step-732-action": 732,
    "step-733-action": 733,
    "spoken-hesitation-observe-originals": 734,
    "spoken-hesitation-consent": 735,
    "spoken-hesitation-consent-2": 736,
    "spoken-hesitation-prepare": 737,
    "spoken-hesitation-walk_to_a": 738,
    "spoken-hesitation-walk_to_b": 739,
    "spoken-hesitation-read_original": 740,
    "spoken-hesitation-return_to_a": 741,
    "spoken-hesitation-place_piece": 742,
    "spoken-hesitation-prepare_cue": 743,
    "spoken-hesitation-brief_cry": 744,
    "spoken-hesitation-perform_cue": 745,
    "spoken-hesitation-take_piece": 746,
    "spoken-hesitation-return_to_entry": 747,
    "spoken-hesitation-return_piece": 748,
    "spoken-hesitation-leave": 749,
    "spoken-hesitation-honest-report": 750,
    "withdrawn-input-observe-originals": 751,
    "withdrawn-input-consent": 752,
    "withdrawn-input-consent-2": 753,
    "withdrawn-input-prepare": 754,
    "withdrawn-input-walk_to_a": 755,
    "withdrawn-input-walk_to_b": 756,
    "withdrawn-input-read_original": 757,
    "withdrawn-input-return_to_a": 758,
    "withdrawn-input-place_piece": 759,
    "withdrawn-input-prepare_pulse": 760,
    "withdrawn-input-spirit_barrier": 761,
    "withdrawn-input-withdraw_consent": 762,
    "withdrawn-input-perform_pulse": 763,
    "withdrawn-input-take_piece": 764,
    "withdrawn-input-return_to_entry": 765,
    "withdrawn-input-return_piece": 766,
    "withdrawn-input-leave": 767,
    "withdrawn-input-honest-report": 768,
    "three-actual-honest-reports-reflected": 769,
    "paid-independent-combat-piece": 770,
    "actual-roderick-contact-elsa-walks-out": 771,
    "independent-optional-fight": 772,
    "combat-round-1": 773,
    "combat-round-2": 774,
    "combat-round-3": 775,
    "combat-round-4": 776,
    "actual-ordinary-encounter-exit": 776,
    "step-777-event_choice": 777,
    "actual-work-after-living-exit": 778
  },
  "provenance": {
    "kind": "EXACT642_PUBLIC_ANCIENT_EVIL_THEN_PUBLIC_ABOMINATION",
    "prior": {
      "kind": "SAME_SEED_COMPLETE_PUBLIC_CONTINUATION",
      "source": "tests/fixtures/silent-disciple-v01570/natural.json",
      "sourceSha256": "04448ba6461db51279b9bdd6ed3736e76d1d9016067e04578ee7885ad8fdf1b9",
      "newRandomChanges": false
    },
    "source": "tests/fixtures/ancient-evil-v01810/natural.json",
    "sourceSha256": "f005b8f8aa0b9d82f14919fbf668a56c4f5a63e1284be94c6f7155b94472c96f",
    "sourceRoot": "final",
    "inheritedDirectedPrefix": false,
    "fullNaturalS9ToS1": true,
    "newRandomChanges": false,
    "preserved": [
      {
        "file": "tests/fixtures/ancient-evil-v01810/natural.json",
        "sha256": "f005b8f8aa0b9d82f14919fbf668a56c4f5a63e1284be94c6f7155b94472c96f",
        "commands": 642,
        "status": "ACTIVE"
      },
      {
        "file": "tests/fixtures/silent-disciple-v01570/natural.json",
        "sha256": "04448ba6461db51279b9bdd6ed3736e76d1d9016067e04578ee7885ad8fdf1b9",
        "commands": 507,
        "status": "ACTIVE"
      }
    ]
  },
  "continuation": {
    "kind": "EXACT642_FULL_SOURCE_THEN_PUBLIC_ABOMINATION",
    "sourceFixture": "tests/fixtures/ancient-evil-v01810/natural.json",
    "sourceRoot": "final",
    "sourceS2Setup": "COMPLETE_ORIGINAL642_LIVING_FINAL",
    "newRandomChanges": false
  },
  "strategy": {
    "source": "EXACT642_FULL_LIVING_ANCIENT_EVIL_FINAL",
    "sourceSeed": "prisoner-natural-v057",
    "sourceCursor": 228,
    "caseMethod": "ABILITY",
    "caseRoute": "CURRENT_PUBLIC_PREFERRED_ACTION_ONCE_EACH_WITH_ORDINARY_COMPLETION_IF_POWER_FAILS",
    "encounterPolicy": "ALL",
    "combatStance": "CONTROL",
    "combatRoundCap": 90,
    "potionAttemptCap": 12,
    "maxCommands": 3500,
    "ordinaryPreparationCap": 600,
    "sourceInjuryRecovery": "NONE_HEALTHY_ORIGINAL642",
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
    "revision": 643,
    "week": 148,
    "date": {
      "epoch": "FIFTH_EPOCH",
      "year": 1352,
      "month": 4,
      "day": 22
    },
    "cash": 730,
    "injuries": [],
    "injuryRisk": 0,
    "random": {
      "seed": "prisoner-natural-v057",
      "cursor": 228
    },
    "H": 100,
    "M": 97,
    "S": 105,
    "AP": 3,
    "pollution": 0,
    "mastery": {
      "chained.s9.prisoner-body": 16,
      "chained.s9.keen-perception": 16,
      "chained.s9.improvised-combat": 32,
      "chained.s8.reason-sacrifice": 8,
      "chained.s8.mental-resistance": 8,
      "chained.s7.werewolf-body": 66,
      "chained.s7.regeneration": 16,
      "chained.s7.toxic-claws": 0,
      "chained.s6.steel-body": 0,
      "chained.s6.death-craft": 0,
      "chained.s5.reflection-step": 25,
      "chained.s5.spirit-possession": 0,
      "chained.s4.object-motion": 8,
      "chained.s4.cursed-form": 33,
      "chained.s4.curse-link": 8,
      "chained.s3.short-transfiguration": 8,
      "chained.s3.measured-curse": 8,
      "chained.s2.enduring-transfiguration": 8,
      "chained.s2.curse-guidance": 8
    },
    "sequence": 2,
    "acting": 100,
    "finance": {
      "weeklyBudget": 3,
      "wagePaidWeek": 147,
      "lifeTier": "DESTITUTE",
      "nextLifeTier": "DESTITUTE",
      "debts": [
        {
          "id": "debt-20-76-0",
          "source": "生活应付款",
          "remaining": 0,
          "weeklyPayment": 30,
          "createdWeek": 20
        },
        {
          "id": "debt-21-80-1",
          "source": "生活应付款",
          "remaining": 0,
          "weeklyPayment": 30,
          "createdWeek": 21
        },
        {
          "id": "debt-29-111-2",
          "source": "生活应付款",
          "remaining": 0,
          "weeklyPayment": 30,
          "createdWeek": 29
        },
        {
          "id": "debt-111-453-3",
          "source": "生活应付款",
          "remaining": 0,
          "weeklyPayment": 30,
          "createdWeek": 111
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
      "will": 24,
      "knowledge": 20
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
    "chained.s9.prisoner-body": 16,
    "chained.s9.keen-perception": 16,
    "chained.s9.improvised-combat": 32,
    "chained.s8.reason-sacrifice": 8,
    "chained.s8.mental-resistance": 8,
    "chained.s7.werewolf-body": 66,
    "chained.s7.regeneration": 16,
    "chained.s7.toxic-claws": 0,
    "chained.s6.steel-body": 0,
    "chained.s6.death-craft": 0,
    "chained.s5.reflection-step": 25,
    "chained.s5.spirit-possession": 0,
    "chained.s4.object-motion": 8,
    "chained.s4.cursed-form": 33,
    "chained.s4.curse-link": 8,
    "chained.s3.short-transfiguration": 8,
    "chained.s3.measured-curse": 8,
    "chained.s2.enduring-transfiguration": 8,
    "chained.s2.curse-guidance": 8
  },
  "final": {
    "status": "ACTIVE",
    "revision": 779,
    "week": 175,
    "date": {
      "epoch": "FIFTH_EPOCH",
      "year": 1352,
      "month": 10,
      "day": 28
    },
    "H": 100,
    "M": 48,
    "S": 82,
    "cash": 180,
    "AP": 2,
    "pollution": 0,
    "injuries": [],
    "injuryRisk": 0,
    "random": {
      "seed": "prisoner-natural-v057",
      "cursor": 291
    },
    "mastery": {
      "chained.s9.prisoner-body": 16,
      "chained.s9.keen-perception": 16,
      "chained.s9.improvised-combat": 32,
      "chained.s8.reason-sacrifice": 8,
      "chained.s8.mental-resistance": 8,
      "chained.s7.werewolf-body": 66,
      "chained.s7.regeneration": 16,
      "chained.s7.toxic-claws": 0,
      "chained.s6.steel-body": 0,
      "chained.s6.death-craft": 0,
      "chained.s5.reflection-step": 25,
      "chained.s5.spirit-possession": 0,
      "chained.s4.object-motion": 8,
      "chained.s4.cursed-form": 33,
      "chained.s4.curse-link": 8,
      "chained.s3.short-transfiguration": 8,
      "chained.s3.measured-curse": 8,
      "chained.s2.enduring-transfiguration": 8,
      "chained.s2.curse-guidance": 8,
      "chained.s1.spirit-barrier": 8,
      "chained.s1.brief-cry": 0
    },
    "sequence": 1,
    "acting": 100,
    "finance": {
      "weeklyBudget": 3,
      "wagePaidWeek": 175,
      "lifeTier": "DESTITUTE",
      "nextLifeTier": "DESTITUTE",
      "debts": [
        {
          "id": "debt-20-76-0",
          "source": "生活应付款",
          "remaining": 0,
          "weeklyPayment": 30,
          "createdWeek": 20
        },
        {
          "id": "debt-21-80-1",
          "source": "生活应付款",
          "remaining": 0,
          "weeklyPayment": 30,
          "createdWeek": 21
        },
        {
          "id": "debt-29-111-2",
          "source": "生活应付款",
          "remaining": 0,
          "weeklyPayment": 30,
          "createdWeek": 29
        },
        {
          "id": "debt-111-453-3",
          "source": "生活应付款",
          "remaining": 0,
          "weeklyPayment": 30,
          "createdWeek": 111
        },
        {
          "id": "debt-174-778-4",
          "source": "生活应付款",
          "remaining": 10,
          "weeklyPayment": 30,
          "createdWeek": 174
        }
      ],
      "missedWeeks": 0,
      "credit": "NORMAL",
      "pulse": "NONE",
      "billAmount": 0
    }
  },
  "promotionWeek": 169,
  "treatments": [],
  "lifeAbilityUse": {
    "chained.s1.spirit-barrier": {
      "attempts": 2,
      "checkSuccesses": 1,
      "actualApplications": 1,
      "reportedApplications": 1
    },
    "chained.s1.brief-cry": {
      "attempts": 1,
      "checkSuccesses": 0,
      "actualApplications": 0,
      "reportedApplications": 0
    }
  },
  "combatAbilityUse": {
    "chained.s1.spirit-barrier": {
      "selectedSlots": 2,
      "paidAttempts": 2,
      "castingSuccesses": 1,
      "preparedWindows": 1,
      "actualApplications": 0,
      "masteryApplications": 0,
      "spiritualitySpent": 16,
      "mindSpent": 6
    },
    "chained.s1.brief-cry": {
      "selectedSlots": 4,
      "paidAttempts": 4,
      "castingSuccesses": 1,
      "preparedWindows": 1,
      "actualApplications": 0,
      "masteryApplications": 0,
      "spiritualitySpent": 32,
      "mindSpent": 14
    }
  },
  "completedCases": [
    "tray-pulse",
    "spoken-hesitation",
    "withdrawn-input"
  ],
  "combatRounds": [
    1,
    2,
    3,
    4
  ],
  "consequenceDomains": [
    "MENTAL",
    "BODY"
  ],
  "terminal": {
    "outcome": "ENEMY_SURRENDERED",
    "round": 4,
    "historyIndex": 17,
    "enemyHealth": 70,
    "enemyMind": 100,
    "enemySpirituality": 76,
    "enemyStatus": "SURRENDERED",
    "formWaitSeconds": 0,
    "exitMetres": 4,
    "exitSeconds": 4
  }
},
};
