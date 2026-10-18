
/** Literal evidence is filled only after the frozen producer's actual run.
 * Never derive expected values from the fixture under test, or substitute a
 * directed run, repaired state, replacement seed, or predicted success. */
export interface PureWhiteAngelCaptureEvidence {
  naturalSha256: string;
  producerSha256: string;
  commandCount: number;
  stage: string;
  error: string | null;
  continuationSource: unknown;
  boundaryNames: number;
  uniqueBoundaryFiles: number;
  uniqueBoundaryBytes: number;
  uniqueBoundaryFinalStates: number;
  boundaryIndexSha256: string;
  integritySha256: string;
  snapshots: string[];
  final: Record<string, unknown>;
  treatments: unknown[];
  acquisitionChecks: unknown[];
  lifeChecks: unknown[];
  lifeAbilityUse: Record<string, unknown>;
  actualCosts: Record<string, unknown>;
  life: Record<string, unknown>;
  lifeCases: Record<string, unknown>;
  encounter: Record<string, unknown>;
  rounds: unknown[];
  bottles: unknown[];
}


/** Frozen from the completed 853-command natural capture, never regenerated at test time. */
export const PURE_WHITE_ANGEL_CAPTURE_EVIDENCE: PureWhiteAngelCaptureEvidence = {
  "naturalSha256": "3f13d554046ecffe3512bda22fb4cd14747be2b06dd6dd47185c025d7d9855f1",
  "producerSha256": "61d919db2c082259b5880abda4cb2c370346a97f0ad193b27f9951f93ec5d285",
  "commandCount": 853,
  "stage": "NATURAL_PURE_WHITE_ANGEL_PUBLIC_CONTINUATION",
  "error": null,
  "continuationSource": null,
  "boundaryNames": 127,
  "uniqueBoundaryFiles": 127,
  "uniqueBoundaryBytes": 125,
  "uniqueBoundaryFinalStates": 125,
  "boundaryIndexSha256": "e0b5be95c6c88d933dd785ee90f52b5698c1dd95741eccdb4d16a50376411f52",
  "integritySha256": "fb9cf031d6c981b33e9bc2861c3f3fa986d08e864bd8d1a9bb58fd66019acf38",
  "snapshots": [
    "departure",
    "recoveredOriginalInjuries",
    "promoted",
    "practiced",
    "recoveredBeforeEncounter",
    "combatStart",
    "combatTerminal"
  ],
  "final": {
    "status": "ACTIVE",
    "revision": 854,
    "week": 196,
    "date": {
      "epoch": "FIFTH_EPOCH",
      "year": 1353,
      "month": 3,
      "day": 24
    },
    "health": 100,
    "mind": 98,
    "spirituality": 106,
    "cash": 1250,
    "actionsRemaining": 3,
    "injuries": [],
    "injuryRisk": 0,
    "random": {
      "seed": "bard-natural-v029",
      "cursor": 385
    },
    "seer": {
      "pollution": 0
    },
    "progression": {
      "sequence": 1,
      "acting": 100,
      "mastery": {
        "sun.s9.praise": 21,
        "sun.s9.courage": 32,
        "sun.s8.light": 24,
        "sun.s8.solar-flame": 33,
        "sun.s8.ritual": 41,
        "sun.s7.holy-light": 0,
        "sun.s7.sacred-oath": 33,
        "sun.s7.sun-aura": 5,
        "sun.s7.holy-water": 16,
        "sun.s6.notarization": 16,
        "sun.s6.signed-contract": 16,
        "sun.s5.holy-light": 0,
        "sun.s5.purification-aura": 30,
        "sun.s4.unshadowed-domain": 8,
        "sun.s4.purification": 8,
        "sun.s4.sunflare": 8,
        "sun.s3.shared-radiance": 0,
        "sun.s3.clarity-mark": 0,
        "sun.s2.guided-radiance": 8,
        "sun.s2.limited-light": 0,
        "sun.s1.focused-purification": 8,
        "sun.s1.warm-radiance-guard": 0
      }
    }
  },
  "treatments": [
    {
      "paidPennies": 60,
      "before": {
        "status": "ACTIVE",
        "revision": 732,
        "week": 175,
        "date": {
          "epoch": "FIFTH_EPOCH",
          "year": 1352,
          "month": 10,
          "day": 28
        },
        "H": 58,
        "M": 100,
        "S": 99,
        "cash": 540,
        "AP": 1,
        "pollution": 0,
        "injuries": [
          {
            "id": "bard-rebuild-natural:combat:1:PLAYER:717:0",
            "severity": "LIGHT",
            "acquiredRevision": 717,
            "treatedRevision": null
          },
          {
            "id": "bard-rebuild-natural:combat:3:PLAYER:719:1",
            "severity": "LIGHT",
            "acquiredRevision": 719,
            "treatedRevision": null
          },
          {
            "id": "bard-rebuild-natural:combat:7:PLAYER:723:2",
            "severity": "HEAVY",
            "acquiredRevision": 723,
            "treatedRevision": null
          }
        ],
        "injuryRisk": 3,
        "random": {
          "seed": "bard-natural-v029",
          "cursor": 356
        },
        "mastery": {
          "sun.s9.praise": 13,
          "sun.s9.courage": 32,
          "sun.s8.light": 8,
          "sun.s8.solar-flame": 33,
          "sun.s8.ritual": 41,
          "sun.s7.holy-light": 0,
          "sun.s7.sacred-oath": 33,
          "sun.s7.sun-aura": 5,
          "sun.s7.holy-water": 16,
          "sun.s6.notarization": 16,
          "sun.s6.signed-contract": 16,
          "sun.s5.holy-light": 0,
          "sun.s5.purification-aura": 30,
          "sun.s4.unshadowed-domain": 8,
          "sun.s4.purification": 8,
          "sun.s4.sunflare": 8,
          "sun.s3.shared-radiance": 0,
          "sun.s3.clarity-mark": 0,
          "sun.s2.guided-radiance": 8,
          "sun.s2.limited-light": 0
        },
        "sequence": 2,
        "acting": 100
      },
      "after": {
        "status": "ACTIVE",
        "revision": 733,
        "week": 175,
        "date": {
          "epoch": "FIFTH_EPOCH",
          "year": 1352,
          "month": 10,
          "day": 28
        },
        "H": 58,
        "M": 100,
        "S": 99,
        "cash": 480,
        "AP": 1,
        "pollution": 0,
        "injuries": [
          {
            "id": "bard-rebuild-natural:combat:1:PLAYER:717:0",
            "severity": "LIGHT",
            "acquiredRevision": 717,
            "treatedRevision": null
          },
          {
            "id": "bard-rebuild-natural:combat:3:PLAYER:719:1",
            "severity": "LIGHT",
            "acquiredRevision": 719,
            "treatedRevision": null
          },
          {
            "id": "bard-rebuild-natural:combat:7:PLAYER:723:2",
            "severity": "HEAVY",
            "acquiredRevision": 723,
            "treatedRevision": 733
          }
        ],
        "injuryRisk": 3,
        "random": {
          "seed": "bard-natural-v029",
          "cursor": 356
        },
        "mastery": {
          "sun.s9.praise": 13,
          "sun.s9.courage": 32,
          "sun.s8.light": 8,
          "sun.s8.solar-flame": 33,
          "sun.s8.ritual": 41,
          "sun.s7.holy-light": 0,
          "sun.s7.sacred-oath": 33,
          "sun.s7.sun-aura": 5,
          "sun.s7.holy-water": 16,
          "sun.s6.notarization": 16,
          "sun.s6.signed-contract": 16,
          "sun.s5.holy-light": 0,
          "sun.s5.purification-aura": 30,
          "sun.s4.unshadowed-domain": 8,
          "sun.s4.purification": 8,
          "sun.s4.sunflare": 8,
          "sun.s3.shared-radiance": 0,
          "sun.s3.clarity-mark": 0,
          "sun.s2.guided-radiance": 8,
          "sun.s2.limited-light": 0
        },
        "sequence": 2,
        "acting": 100
      }
    }
  ],
  "acquisitionChecks": [
    [
      {
        "type": "CONSUME",
        "bottleId": "pure-white-angel-potion-1",
        "confirmed": true
      },
      186,
      1,
      48,
      "GREAT_SUCCESS",
      356,
      357
    ]
  ],
  "lifeChecks": [
    [
      "FOCUSED_PURIFICATION",
      30,
      20,
      74,
      "SUCCESS",
      357,
      358
    ],
    [
      "CLEANSE_SAMPLE",
      30,
      67,
      94,
      "SUCCESS",
      358,
      359
    ],
    [
      "WARM_RADIANCE_GUARD",
      25,
      86,
      64,
      "FAILURE",
      359,
      360
    ],
    [
      "WARM_RADIANCE_GUARD",
      25,
      6,
      64,
      "SUCCESS",
      360,
      361
    ]
  ],
  "lifeAbilityUse": {
    "sun.s1.focused-purification": {
      "actualCasts": 1,
      "successfulWindows": 1,
      "actualApplications": 1,
      "states": [
        "APPLIED",
        "NONE",
        "NONE"
      ]
    },
    "sun.s1.warm-radiance-guard": {
      "actualCasts": 2,
      "successfulWindows": 1,
      "actualApplications": 0,
      "states": [
        "NONE",
        "FAILED",
        "INVALIDATED"
      ]
    }
  },
  "actualCosts": {
    "acquisitionCash": 1750,
    "acquisitionAP": 10,
    "lifeCash": 90,
    "lifeAP": 12,
    "lifeSpirituality": 20,
    "lifeMind": 6,
    "lifeHealthLost": 0,
    "sourceMaraEnergy": 6,
    "sourceMaraWalkedMetres": 0,
    "actualPlayerWalkedMetres": 66,
    "sourceGalleryWalkedMetres": 42,
    "ivanWalkedMetres": 102,
    "sourceClockSeconds": 280,
    "originalResidueUnitsConsumed": 1,
    "originalShutterDurabilitySpent": 2,
    "personalPadDurabilitySpent": 20,
    "combatSpirituality": 14,
    "combatMindCasting": 2,
    "enemySpirituality": 21,
    "enemyRodChargesSpent": 1,
    "clinic": 60,
    "ordinaryWorkCount": 18,
    "ordinaryRestCount": 20
  },
  "life": {
    "clockSeconds": 1256,
    "elapsedSeconds": 280,
    "playerLocation": "OUTSIDE",
    "playerTravelMetres": 66,
    "maraPresent": false,
    "ivan": {
      "id": "PW1-IVAN-MERROW",
      "name": "伊文·梅罗",
      "age": 43,
      "alive": true,
      "health": 100,
      "mind": 100,
      "present": false,
      "location": "AWAY",
      "travelMetres": 102
    },
    "sample": {
      "id": "PW1-RESIDUE-1",
      "owner": "PLAYER",
      "price": 40,
      "purchasedWeek": 187,
      "location": "PLAYER",
      "residueUnits": 0,
      "contained": false,
      "version": 2
    },
    "pad": {
      "id": "PW1-PAD-1",
      "owner": "PLAYER",
      "price": 20,
      "purchasedWeek": 187,
      "location": "PLAYER",
      "durability": 80,
      "impacts": 0,
      "resets": 2
    },
    "pending": null
  },
  "lifeCases": {
    "residue-trace": {
      "status": "RESOLVED",
      "observedWeek": 186,
      "method": "ABILITY",
      "result": "ABILITY",
      "contactOpen": false,
      "returned": true,
      "invitationWeeks": [
        188
      ],
      "attempts": [
        {
          "week": 188,
          "method": "ABILITY",
          "closed": true,
          "result": "ABILITY",
          "elapsedSeconds": 67,
          "playerTravelMetres": 16,
          "maraTravelMetres": 0,
          "ivanTravelMetres": 26,
          "ownerEnergySpent": 2,
          "spiritualitySpent": 8,
          "mindSpent": 2,
          "permission": {
            "owner": "GRANTED",
            "technician": "GRANTED",
            "ability": "GRANTED"
          },
          "permissionVersion": 3,
          "sourceRead": true,
          "spiritAsked": true,
          "spiritAnswer": "DECLINED",
          "refusalAcknowledged": true,
          "returnAgreed": true,
          "entered": true,
          "exited": true,
          "samplePlaced": true,
          "sampleRetrieved": true,
          "observedSampleVersions": [
            1
          ],
          "cleanseAttempted": true,
          "cleanseTier": "SUCCESS",
          "sampleHandled": true,
          "manualContained": false,
          "padWorn": false,
          "padRetrieved": false,
          "impactDeclared": false,
          "impactReleased": false,
          "impactReset": false,
          "healthPrevented": 0,
          "conditionChanged": false,
          "shutterReopened": false,
          "stopped": false,
          "focused": {
            "attempts": 1,
            "successes": 1,
            "effects": 1,
            "tier": "SUCCESS",
            "state": "APPLIED",
            "remainingSeconds": 0,
            "conditionVersion": 1
          },
          "guard": {
            "attempts": 0,
            "successes": 0,
            "effects": 0,
            "tier": null,
            "state": "NONE",
            "remainingSeconds": 0,
            "conditionVersion": null
          }
        }
      ]
    },
    "personal-impact": {
      "status": "RESOLVED",
      "observedWeek": 189,
      "method": "ABILITY",
      "result": "ORDINARY",
      "contactOpen": false,
      "returned": true,
      "invitationWeeks": [
        190
      ],
      "attempts": [
        {
          "week": 190,
          "method": "ABILITY",
          "closed": true,
          "result": "ORDINARY",
          "elapsedSeconds": 65,
          "playerTravelMetres": 16,
          "maraTravelMetres": 0,
          "ivanTravelMetres": 26,
          "ownerEnergySpent": 2,
          "spiritualitySpent": 6,
          "mindSpent": 2,
          "permission": {
            "owner": "GRANTED",
            "technician": "GRANTED",
            "ability": "GRANTED"
          },
          "permissionVersion": 3,
          "sourceRead": true,
          "spiritAsked": true,
          "spiritAnswer": "DECLINED",
          "refusalAcknowledged": true,
          "returnAgreed": true,
          "entered": true,
          "exited": true,
          "samplePlaced": false,
          "sampleRetrieved": false,
          "observedSampleVersions": [],
          "cleanseAttempted": false,
          "cleanseTier": null,
          "sampleHandled": false,
          "manualContained": false,
          "padWorn": true,
          "padRetrieved": true,
          "impactDeclared": true,
          "impactReleased": false,
          "impactReset": true,
          "healthPrevented": 0,
          "conditionChanged": false,
          "shutterReopened": false,
          "stopped": false,
          "focused": {
            "attempts": 0,
            "successes": 0,
            "effects": 0,
            "tier": null,
            "state": "NONE",
            "remainingSeconds": 0,
            "conditionVersion": null
          },
          "guard": {
            "attempts": 1,
            "successes": 0,
            "effects": 0,
            "tier": "FAILURE",
            "state": "FAILED",
            "remainingSeconds": 0,
            "conditionVersion": 1
          }
        }
      ]
    },
    "screened-return": {
      "status": "RESOLVED",
      "observedWeek": 191,
      "method": "ABILITY",
      "result": "ORDINARY",
      "contactOpen": false,
      "returned": true,
      "invitationWeeks": [
        192
      ],
      "attempts": [
        {
          "week": 192,
          "method": "ABILITY",
          "closed": true,
          "result": "ORDINARY",
          "elapsedSeconds": 97,
          "playerTravelMetres": 22,
          "maraTravelMetres": 0,
          "ivanTravelMetres": 50,
          "ownerEnergySpent": 2,
          "spiritualitySpent": 6,
          "mindSpent": 2,
          "permission": {
            "owner": "WITHDRAWN",
            "technician": "GRANTED",
            "ability": "GRANTED"
          },
          "permissionVersion": 4,
          "sourceRead": true,
          "spiritAsked": true,
          "spiritAnswer": "DECLINED",
          "refusalAcknowledged": true,
          "returnAgreed": true,
          "entered": true,
          "exited": true,
          "samplePlaced": false,
          "sampleRetrieved": false,
          "observedSampleVersions": [],
          "cleanseAttempted": false,
          "cleanseTier": null,
          "sampleHandled": false,
          "manualContained": false,
          "padWorn": true,
          "padRetrieved": true,
          "impactDeclared": true,
          "impactReleased": false,
          "impactReset": true,
          "healthPrevented": 0,
          "conditionChanged": true,
          "shutterReopened": true,
          "stopped": true,
          "focused": {
            "attempts": 0,
            "successes": 0,
            "effects": 0,
            "tier": null,
            "state": "NONE",
            "remainingSeconds": 0,
            "conditionVersion": null
          },
          "guard": {
            "attempts": 1,
            "successes": 1,
            "effects": 0,
            "tier": "SUCCESS",
            "state": "INVALIDATED",
            "remainingSeconds": 0,
            "conditionVersion": 1
          }
        }
      ]
    }
  },
  "encounter": {
    "status": "RESOLVED",
    "terminal": {
      "outcome": "ENEMY_SURRENDERED",
      "round": 1,
      "historyIndex": 23,
      "enemyHealth": 70,
      "enemyMind": 100,
      "enemySpirituality": 99,
      "enemyStatus": "SURRENDERED",
      "exitMetres": 4,
      "exitSeconds": 4
    },
    "scene": {
      "siteId": "PW1-FORECOURT",
      "playerLocation": "OUTSIDE",
      "playerCoordinate": 0,
      "enemyCoordinate": 6,
      "ordinaryExit": "OPEN",
      "visibleBodyLine": true,
      "conditionVersion": 1,
      "observedConditionVersion": 1,
      "thirdPartiesInArea": 0,
      "presentMemberIds": [],
      "observedSourceId": "bard-rebuild-natural:PW1-FORECOURT:850",
      "observationWeek": 195,
      "clockSeconds": 68,
      "externalSeconds": 68,
      "playerTravelMetres": 8,
      "knownPlayerName": "塞琳",
      "knownEnemyName": "西拉斯·戴恩"
    },
    "materials": {
      "weapon": {
        "id": "PW1-SILAS-ROD",
        "sourceId": "PW1-SILAS-OWNED-ROD-1",
        "owner": "PW1-SILAS-DANE",
        "massKg": 2,
        "location": "FORECOURT",
        "condition": 100,
        "charge": 3,
        "capacity": 4,
        "visible": true,
        "pieces": [
          {
            "id": "PW1-SILAS-CHARGE-1",
            "state": "SPENT"
          },
          {
            "id": "PW1-SILAS-CHARGE-2",
            "state": "CHARGED"
          },
          {
            "id": "PW1-SILAS-CHARGE-3",
            "state": "CHARGED"
          },
          {
            "id": "PW1-SILAS-CHARGE-4",
            "state": "CHARGED"
          }
        ]
      },
      "screen": {
        "id": "PW1-SILAS-SCREEN",
        "sourceId": "PW1-SILAS-OWNED-SCREEN-1",
        "owner": "PW1-SILAS-DANE",
        "coordinate": 5,
        "hood": "OPEN",
        "durability": 100,
        "operations": 0
      }
    },
    "enemyHealth": 70,
    "enemyMind": 100,
    "enemySpirituality": 99,
    "enemyInjuries": [
      {
        "id": "bard-rebuild-natural:combat:1:ENEMY:853:0",
        "severity": "HEAVY",
        "acquiredRevision": 853,
        "treatedRevision": null
      }
    ],
    "powerUses": {
      "LIGHT_STRIKE": 1,
      "LIGHT_WARD": 0,
      "DAZZLING_PRESSURE": 2,
      "OBSCURE": 0
    },
    "inheritedApplications": {
      "sun.s9.praise": 1,
      "sun.s8.light": 2
    },
    "screenReveals": 0,
    "focusedPurification": {
      "actualCasts": 0,
      "successfulWindows": 0,
      "actualApplications": 0
    },
    "warmRadianceGuard": {
      "actualCasts": 1,
      "successfulWindows": 0,
      "actualApplications": 0
    }
  },
  "rounds": [
    {
      "round": 1,
      "stance": "CONTROL",
      "first": "PLAYER",
      "countWheels": {
        "playerRoll": 87,
        "playerCount": 5,
        "enemyRoll": 68,
        "enemyCount": 4
      },
      "consequenceDomain": "BODY",
      "consequenceRoll": 76,
      "result": {
        "playerHealth": 100,
        "playerMind": 98,
        "playerSpirituality": 106,
        "enemyHealth": 70,
        "enemyMind": 100,
        "enemySpirituality": 99,
        "actualPlayerActions": 5,
        "actualEnemyActions": 4,
        "actualOrderedActions": [
          {
            "order": 0,
            "actor": "PLAYER",
            "id": "sun.s9.praise",
            "planned": "sun.s9.praise",
            "selectedAbility": "sun.s9.praise",
            "fallbackReason": null,
            "label": "继承自身短吟。意志检定63，成功。仅当次有限实际效果，未建立跨轮免费能力。 实际5秒，条件1，本人灵性118、精神100，对手灵性120。",
            "selfGain": 5.2728,
            "enemyReduction": 0,
            "threatens": false,
            "mentalPressure": false,
            "attackKind": "NONE",
            "lightEffect": false,
            "rawContribution": 5.2728,
            "rawReduction": 0,
            "paidCost": 2,
            "mindCost": 0,
            "physicalFactor": 1,
            "check": {
              "ability": "will",
              "baseAbility": 30,
              "modifiers": [],
              "effectiveAbility": 30,
              "difficulty": 12,
              "chance": 86,
              "roll": 63,
              "tier": "SUCCESS"
            },
            "resistanceRoll": 44,
            "resistanceChance": 30,
            "succeeded": true,
            "finiteResult": "APPLIED",
            "windowsBefore": {
              "focusedPurification": null,
              "warmRadianceGuard": null,
              "notarization": null,
              "limitedLight": null,
              "enemyWard": null
            },
            "windowsAfter": {
              "focusedPurification": null,
              "warmRadianceGuard": null,
              "notarization": null,
              "limitedLight": null,
              "enemyWard": null
            },
            "pendingBefore": {
              "id": "bard-rebuild-natural:PW1-PENDING:1:0",
              "planned": "DAZZLING_PRESSURE",
              "actual": "DAZZLING_PRESSURE",
              "declaredAt": 4,
              "observedAt": 4,
              "observationSeconds": 0,
              "conditionVersion": 1,
              "visible": true,
              "bodyImpact": false
            },
            "pendingAfter": {
              "id": "bard-rebuild-natural:PW1-PENDING:1:0",
              "planned": "DAZZLING_PRESSURE",
              "actual": "DAZZLING_PRESSURE",
              "declaredAt": 4,
              "observedAt": 4,
              "observationSeconds": 0,
              "conditionVersion": 1,
              "visible": true,
              "bodyImpact": false
            },
            "masteryApplied": [
              "sun.s9.praise"
            ],
            "countered": [],
            "rodChargeSpent": 0,
            "chargePieceId": null,
            "materialsBefore": {
              "weapon": {
                "id": "PW1-SILAS-ROD",
                "sourceId": "PW1-SILAS-OWNED-ROD-1",
                "owner": "PW1-SILAS-DANE",
                "massKg": 2,
                "location": "HAND",
                "condition": 100,
                "charge": 4,
                "capacity": 4,
                "visible": true,
                "pieces": [
                  {
                    "id": "PW1-SILAS-CHARGE-1",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-2",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-3",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-4",
                    "state": "CHARGED"
                  }
                ]
              },
              "screen": {
                "id": "PW1-SILAS-SCREEN",
                "sourceId": "PW1-SILAS-OWNED-SCREEN-1",
                "owner": "PW1-SILAS-DANE",
                "coordinate": 5,
                "hood": "OPEN",
                "durability": 100,
                "operations": 0
              }
            },
            "materialsAfter": {
              "weapon": {
                "id": "PW1-SILAS-ROD",
                "sourceId": "PW1-SILAS-OWNED-ROD-1",
                "owner": "PW1-SILAS-DANE",
                "massKg": 2,
                "location": "HAND",
                "condition": 100,
                "charge": 4,
                "capacity": 4,
                "visible": true,
                "pieces": [
                  {
                    "id": "PW1-SILAS-CHARGE-1",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-2",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-3",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-4",
                    "state": "CHARGED"
                  }
                ]
              },
              "screen": {
                "id": "PW1-SILAS-SCREEN",
                "sourceId": "PW1-SILAS-OWNED-SCREEN-1",
                "owner": "PW1-SILAS-DANE",
                "coordinate": 5,
                "hood": "OPEN",
                "durability": 100,
                "operations": 0
              }
            },
            "conditionVersionBefore": 1,
            "conditionVersionAfter": 1,
            "atSeconds": 4,
            "elapsedSeconds": 5,
            "travelMetres": 0,
            "travelPath": [
              4
            ],
            "lateralTravelPath": [
              0
            ],
            "randomCursorBefore": 365,
            "randomCursorAfter": 367,
            "playerMindAfter": 100,
            "playerSpiritualityAfter": 118,
            "enemyMindAfter": 100,
            "enemySpiritualityAfter": 120
          },
          {
            "order": 1,
            "actor": "ENEMY",
            "id": "DAZZLING_PRESSURE",
            "planned": "DAZZLING_PRESSURE",
            "selectedAbility": "DAZZLING_PRESSURE",
            "fallbackReason": null,
            "label": "西拉斯实际施放有限眩光压力，独立灵性−7。对方实际抵抗，成本保留。 实际5秒，条件1，本人灵性118、精神100，对手灵性113。",
            "selfGain": 0,
            "enemyReduction": 0,
            "threatens": false,
            "mentalPressure": false,
            "attackKind": "NONE",
            "lightEffect": false,
            "rawContribution": 0,
            "rawReduction": 0,
            "paidCost": 7,
            "mindCost": 0,
            "physicalFactor": 1,
            "check": null,
            "resistanceRoll": 25,
            "resistanceChance": 30,
            "succeeded": false,
            "finiteResult": "RESISTED",
            "windowsBefore": {
              "focusedPurification": null,
              "warmRadianceGuard": null,
              "notarization": null,
              "limitedLight": null,
              "enemyWard": null
            },
            "windowsAfter": {
              "focusedPurification": null,
              "warmRadianceGuard": null,
              "notarization": null,
              "limitedLight": null,
              "enemyWard": null
            },
            "pendingBefore": {
              "id": "bard-rebuild-natural:PW1-PENDING:1:0",
              "planned": "DAZZLING_PRESSURE",
              "actual": "DAZZLING_PRESSURE",
              "declaredAt": 4,
              "observedAt": 4,
              "observationSeconds": 0,
              "conditionVersion": 1,
              "visible": true,
              "bodyImpact": false
            },
            "pendingAfter": null,
            "masteryApplied": [],
            "countered": [],
            "rodChargeSpent": 0,
            "chargePieceId": null,
            "materialsBefore": {
              "weapon": {
                "id": "PW1-SILAS-ROD",
                "sourceId": "PW1-SILAS-OWNED-ROD-1",
                "owner": "PW1-SILAS-DANE",
                "massKg": 2,
                "location": "HAND",
                "condition": 100,
                "charge": 4,
                "capacity": 4,
                "visible": true,
                "pieces": [
                  {
                    "id": "PW1-SILAS-CHARGE-1",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-2",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-3",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-4",
                    "state": "CHARGED"
                  }
                ]
              },
              "screen": {
                "id": "PW1-SILAS-SCREEN",
                "sourceId": "PW1-SILAS-OWNED-SCREEN-1",
                "owner": "PW1-SILAS-DANE",
                "coordinate": 5,
                "hood": "OPEN",
                "durability": 100,
                "operations": 0
              }
            },
            "materialsAfter": {
              "weapon": {
                "id": "PW1-SILAS-ROD",
                "sourceId": "PW1-SILAS-OWNED-ROD-1",
                "owner": "PW1-SILAS-DANE",
                "massKg": 2,
                "location": "HAND",
                "condition": 100,
                "charge": 4,
                "capacity": 4,
                "visible": true,
                "pieces": [
                  {
                    "id": "PW1-SILAS-CHARGE-1",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-2",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-3",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-4",
                    "state": "CHARGED"
                  }
                ]
              },
              "screen": {
                "id": "PW1-SILAS-SCREEN",
                "sourceId": "PW1-SILAS-OWNED-SCREEN-1",
                "owner": "PW1-SILAS-DANE",
                "coordinate": 5,
                "hood": "OPEN",
                "durability": 100,
                "operations": 0
              }
            },
            "conditionVersionBefore": 1,
            "conditionVersionAfter": 1,
            "atSeconds": 9,
            "elapsedSeconds": 5,
            "travelMetres": 0,
            "travelPath": [
              6
            ],
            "lateralTravelPath": [
              0
            ],
            "randomCursorBefore": 367,
            "randomCursorAfter": 368,
            "playerMindAfter": 100,
            "playerSpiritualityAfter": 118,
            "enemyMindAfter": 100,
            "enemySpiritualityAfter": 113
          },
          {
            "order": 2,
            "actor": "PLAYER",
            "id": "sun.s2.limited-light",
            "planned": "sun.s2.limited-light",
            "selectedAbility": "sun.s2.limited-light",
            "fallbackReason": null,
            "label": "实付6灵性，只预备本轮下一次实际敌方光击减45。知识检定65，失败。 实际5秒，条件1，本人灵性112、精神100，对手灵性113。",
            "selfGain": 0,
            "enemyReduction": 0,
            "threatens": false,
            "mentalPressure": false,
            "attackKind": "NONE",
            "lightEffect": false,
            "rawContribution": 0,
            "rawReduction": 0,
            "paidCost": 6,
            "mindCost": 0,
            "physicalFactor": 1,
            "check": {
              "ability": "knowledge",
              "baseAbility": 25,
              "modifiers": [],
              "effectiveAbility": 25,
              "difficulty": 20,
              "chance": 60,
              "roll": 65,
              "tier": "FAILURE"
            },
            "resistanceRoll": null,
            "resistanceChance": null,
            "succeeded": false,
            "finiteResult": "FAILED",
            "windowsBefore": {
              "focusedPurification": null,
              "warmRadianceGuard": null,
              "notarization": null,
              "limitedLight": null,
              "enemyWard": null
            },
            "windowsAfter": {
              "focusedPurification": null,
              "warmRadianceGuard": null,
              "notarization": null,
              "limitedLight": null,
              "enemyWard": null
            },
            "pendingBefore": {
              "id": "bard-rebuild-natural:PW1-PENDING:1:1",
              "planned": "DAZZLING_PRESSURE",
              "actual": "DAZZLING_PRESSURE",
              "declaredAt": 14,
              "observedAt": 14,
              "observationSeconds": 0,
              "conditionVersion": 1,
              "visible": true,
              "bodyImpact": false
            },
            "pendingAfter": {
              "id": "bard-rebuild-natural:PW1-PENDING:1:1",
              "planned": "DAZZLING_PRESSURE",
              "actual": "DAZZLING_PRESSURE",
              "declaredAt": 14,
              "observedAt": 14,
              "observationSeconds": 0,
              "conditionVersion": 1,
              "visible": true,
              "bodyImpact": false
            },
            "masteryApplied": [],
            "countered": [],
            "rodChargeSpent": 0,
            "chargePieceId": null,
            "materialsBefore": {
              "weapon": {
                "id": "PW1-SILAS-ROD",
                "sourceId": "PW1-SILAS-OWNED-ROD-1",
                "owner": "PW1-SILAS-DANE",
                "massKg": 2,
                "location": "HAND",
                "condition": 100,
                "charge": 4,
                "capacity": 4,
                "visible": true,
                "pieces": [
                  {
                    "id": "PW1-SILAS-CHARGE-1",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-2",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-3",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-4",
                    "state": "CHARGED"
                  }
                ]
              },
              "screen": {
                "id": "PW1-SILAS-SCREEN",
                "sourceId": "PW1-SILAS-OWNED-SCREEN-1",
                "owner": "PW1-SILAS-DANE",
                "coordinate": 5,
                "hood": "OPEN",
                "durability": 100,
                "operations": 0
              }
            },
            "materialsAfter": {
              "weapon": {
                "id": "PW1-SILAS-ROD",
                "sourceId": "PW1-SILAS-OWNED-ROD-1",
                "owner": "PW1-SILAS-DANE",
                "massKg": 2,
                "location": "HAND",
                "condition": 100,
                "charge": 4,
                "capacity": 4,
                "visible": true,
                "pieces": [
                  {
                    "id": "PW1-SILAS-CHARGE-1",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-2",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-3",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-4",
                    "state": "CHARGED"
                  }
                ]
              },
              "screen": {
                "id": "PW1-SILAS-SCREEN",
                "sourceId": "PW1-SILAS-OWNED-SCREEN-1",
                "owner": "PW1-SILAS-DANE",
                "coordinate": 5,
                "hood": "OPEN",
                "durability": 100,
                "operations": 0
              }
            },
            "conditionVersionBefore": 1,
            "conditionVersionAfter": 1,
            "atSeconds": 14,
            "elapsedSeconds": 5,
            "travelMetres": 0,
            "travelPath": [
              4
            ],
            "lateralTravelPath": [
              0
            ],
            "randomCursorBefore": 370,
            "randomCursorAfter": 371,
            "playerMindAfter": 100,
            "playerSpiritualityAfter": 112,
            "enemyMindAfter": 100,
            "enemySpiritualityAfter": 113
          },
          {
            "order": 3,
            "actor": "ENEMY",
            "id": "DAZZLING_PRESSURE",
            "planned": "DAZZLING_PRESSURE",
            "selectedAbility": "DAZZLING_PRESSURE",
            "fallbackReason": null,
            "label": "西拉斯实际施放有限眩光压力，独立灵性−7。 实际5秒，条件1，本人灵性112、精神100，对手灵性106。",
            "selfGain": 65,
            "enemyReduction": 0,
            "threatens": false,
            "mentalPressure": true,
            "attackKind": "MENTAL",
            "lightEffect": false,
            "rawContribution": 65,
            "rawReduction": 0,
            "paidCost": 7,
            "mindCost": 0,
            "physicalFactor": 1,
            "check": null,
            "resistanceRoll": 84,
            "resistanceChance": 30,
            "succeeded": true,
            "finiteResult": "APPLIED",
            "windowsBefore": {
              "focusedPurification": null,
              "warmRadianceGuard": null,
              "notarization": null,
              "limitedLight": null,
              "enemyWard": null
            },
            "windowsAfter": {
              "focusedPurification": null,
              "warmRadianceGuard": null,
              "notarization": null,
              "limitedLight": null,
              "enemyWard": null
            },
            "pendingBefore": {
              "id": "bard-rebuild-natural:PW1-PENDING:1:1",
              "planned": "DAZZLING_PRESSURE",
              "actual": "DAZZLING_PRESSURE",
              "declaredAt": 14,
              "observedAt": 14,
              "observationSeconds": 0,
              "conditionVersion": 1,
              "visible": true,
              "bodyImpact": false
            },
            "pendingAfter": null,
            "masteryApplied": [],
            "countered": [],
            "rodChargeSpent": 0,
            "chargePieceId": null,
            "materialsBefore": {
              "weapon": {
                "id": "PW1-SILAS-ROD",
                "sourceId": "PW1-SILAS-OWNED-ROD-1",
                "owner": "PW1-SILAS-DANE",
                "massKg": 2,
                "location": "HAND",
                "condition": 100,
                "charge": 4,
                "capacity": 4,
                "visible": true,
                "pieces": [
                  {
                    "id": "PW1-SILAS-CHARGE-1",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-2",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-3",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-4",
                    "state": "CHARGED"
                  }
                ]
              },
              "screen": {
                "id": "PW1-SILAS-SCREEN",
                "sourceId": "PW1-SILAS-OWNED-SCREEN-1",
                "owner": "PW1-SILAS-DANE",
                "coordinate": 5,
                "hood": "OPEN",
                "durability": 100,
                "operations": 0
              }
            },
            "materialsAfter": {
              "weapon": {
                "id": "PW1-SILAS-ROD",
                "sourceId": "PW1-SILAS-OWNED-ROD-1",
                "owner": "PW1-SILAS-DANE",
                "massKg": 2,
                "location": "HAND",
                "condition": 100,
                "charge": 4,
                "capacity": 4,
                "visible": true,
                "pieces": [
                  {
                    "id": "PW1-SILAS-CHARGE-1",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-2",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-3",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-4",
                    "state": "CHARGED"
                  }
                ]
              },
              "screen": {
                "id": "PW1-SILAS-SCREEN",
                "sourceId": "PW1-SILAS-OWNED-SCREEN-1",
                "owner": "PW1-SILAS-DANE",
                "coordinate": 5,
                "hood": "OPEN",
                "durability": 100,
                "operations": 0
              }
            },
            "conditionVersionBefore": 1,
            "conditionVersionAfter": 1,
            "atSeconds": 19,
            "elapsedSeconds": 5,
            "travelMetres": 0,
            "travelPath": [
              6
            ],
            "lateralTravelPath": [
              0
            ],
            "randomCursorBefore": 371,
            "randomCursorAfter": 372,
            "playerMindAfter": 100,
            "playerSpiritualityAfter": 112,
            "enemyMindAfter": 100,
            "enemySpiritualityAfter": 106
          },
          {
            "order": 4,
            "actor": "PLAYER",
            "id": "sun.s8.light",
            "planned": "sun.s8.light",
            "selectedAbility": "sun.s8.light",
            "fallbackReason": null,
            "label": "继承有限日光。意志检定41，成功。仅当次有限实际效果，未建立跨轮免费能力。 实际5秒，条件1，本人灵性112、精神100，对手灵性106。",
            "selfGain": 12.784200000000002,
            "enemyReduction": 0,
            "threatens": true,
            "mentalPressure": false,
            "attackKind": "BODY",
            "lightEffect": true,
            "rawContribution": 12.784200000000002,
            "rawReduction": 0,
            "paidCost": 0,
            "mindCost": 0,
            "physicalFactor": 1,
            "check": {
              "ability": "will",
              "baseAbility": 30,
              "modifiers": [],
              "effectiveAbility": 30,
              "difficulty": 14,
              "chance": 82,
              "roll": 41,
              "tier": "SUCCESS"
            },
            "resistanceRoll": 60,
            "resistanceChance": 30,
            "succeeded": true,
            "finiteResult": "APPLIED",
            "windowsBefore": {
              "focusedPurification": null,
              "warmRadianceGuard": null,
              "notarization": null,
              "limitedLight": null,
              "enemyWard": null
            },
            "windowsAfter": {
              "focusedPurification": null,
              "warmRadianceGuard": null,
              "notarization": null,
              "limitedLight": null,
              "enemyWard": null
            },
            "pendingBefore": {
              "id": "bard-rebuild-natural:PW1-PENDING:1:2",
              "planned": "LIGHT_STRIKE",
              "actual": "LIGHT_STRIKE",
              "declaredAt": 24,
              "observedAt": 24,
              "observationSeconds": 0,
              "conditionVersion": 1,
              "visible": true,
              "bodyImpact": true
            },
            "pendingAfter": {
              "id": "bard-rebuild-natural:PW1-PENDING:1:2",
              "planned": "LIGHT_STRIKE",
              "actual": "LIGHT_STRIKE",
              "declaredAt": 24,
              "observedAt": 24,
              "observationSeconds": 0,
              "conditionVersion": 1,
              "visible": true,
              "bodyImpact": true
            },
            "masteryApplied": [
              "sun.s8.light"
            ],
            "countered": [],
            "rodChargeSpent": 0,
            "chargePieceId": null,
            "materialsBefore": {
              "weapon": {
                "id": "PW1-SILAS-ROD",
                "sourceId": "PW1-SILAS-OWNED-ROD-1",
                "owner": "PW1-SILAS-DANE",
                "massKg": 2,
                "location": "HAND",
                "condition": 100,
                "charge": 4,
                "capacity": 4,
                "visible": true,
                "pieces": [
                  {
                    "id": "PW1-SILAS-CHARGE-1",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-2",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-3",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-4",
                    "state": "CHARGED"
                  }
                ]
              },
              "screen": {
                "id": "PW1-SILAS-SCREEN",
                "sourceId": "PW1-SILAS-OWNED-SCREEN-1",
                "owner": "PW1-SILAS-DANE",
                "coordinate": 5,
                "hood": "OPEN",
                "durability": 100,
                "operations": 0
              }
            },
            "materialsAfter": {
              "weapon": {
                "id": "PW1-SILAS-ROD",
                "sourceId": "PW1-SILAS-OWNED-ROD-1",
                "owner": "PW1-SILAS-DANE",
                "massKg": 2,
                "location": "HAND",
                "condition": 100,
                "charge": 4,
                "capacity": 4,
                "visible": true,
                "pieces": [
                  {
                    "id": "PW1-SILAS-CHARGE-1",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-2",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-3",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-4",
                    "state": "CHARGED"
                  }
                ]
              },
              "screen": {
                "id": "PW1-SILAS-SCREEN",
                "sourceId": "PW1-SILAS-OWNED-SCREEN-1",
                "owner": "PW1-SILAS-DANE",
                "coordinate": 5,
                "hood": "OPEN",
                "durability": 100,
                "operations": 0
              }
            },
            "conditionVersionBefore": 1,
            "conditionVersionAfter": 1,
            "atSeconds": 24,
            "elapsedSeconds": 5,
            "travelMetres": 0,
            "travelPath": [
              4
            ],
            "lateralTravelPath": [
              0
            ],
            "randomCursorBefore": 374,
            "randomCursorAfter": 376,
            "playerMindAfter": 100,
            "playerSpiritualityAfter": 112,
            "enemyMindAfter": 100,
            "enemySpiritualityAfter": 106
          },
          {
            "order": 5,
            "actor": "ENEMY",
            "id": "LIGHT_STRIKE",
            "planned": "LIGHT_STRIKE",
            "selectedAbility": "LIGHT_STRIKE",
            "fallbackReason": null,
            "label": "西拉斯实际施放原杆有限光击，独立灵性−7。 实际5秒，条件1，本人灵性112、精神100，对手灵性99。",
            "selfGain": 105,
            "enemyReduction": 0,
            "threatens": true,
            "mentalPressure": false,
            "attackKind": "BODY",
            "lightEffect": true,
            "rawContribution": 105,
            "rawReduction": 0,
            "paidCost": 7,
            "mindCost": 0,
            "physicalFactor": 1,
            "check": null,
            "resistanceRoll": 79,
            "resistanceChance": 30,
            "succeeded": true,
            "finiteResult": "APPLIED",
            "windowsBefore": {
              "focusedPurification": null,
              "warmRadianceGuard": null,
              "notarization": null,
              "limitedLight": null,
              "enemyWard": null
            },
            "windowsAfter": {
              "focusedPurification": null,
              "warmRadianceGuard": null,
              "notarization": null,
              "limitedLight": null,
              "enemyWard": null
            },
            "pendingBefore": {
              "id": "bard-rebuild-natural:PW1-PENDING:1:2",
              "planned": "LIGHT_STRIKE",
              "actual": "LIGHT_STRIKE",
              "declaredAt": 24,
              "observedAt": 24,
              "observationSeconds": 0,
              "conditionVersion": 1,
              "visible": true,
              "bodyImpact": true
            },
            "pendingAfter": null,
            "masteryApplied": [],
            "countered": [],
            "rodChargeSpent": 1,
            "chargePieceId": "PW1-SILAS-CHARGE-1",
            "materialsBefore": {
              "weapon": {
                "id": "PW1-SILAS-ROD",
                "sourceId": "PW1-SILAS-OWNED-ROD-1",
                "owner": "PW1-SILAS-DANE",
                "massKg": 2,
                "location": "HAND",
                "condition": 100,
                "charge": 4,
                "capacity": 4,
                "visible": true,
                "pieces": [
                  {
                    "id": "PW1-SILAS-CHARGE-1",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-2",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-3",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-4",
                    "state": "CHARGED"
                  }
                ]
              },
              "screen": {
                "id": "PW1-SILAS-SCREEN",
                "sourceId": "PW1-SILAS-OWNED-SCREEN-1",
                "owner": "PW1-SILAS-DANE",
                "coordinate": 5,
                "hood": "OPEN",
                "durability": 100,
                "operations": 0
              }
            },
            "materialsAfter": {
              "weapon": {
                "id": "PW1-SILAS-ROD",
                "sourceId": "PW1-SILAS-OWNED-ROD-1",
                "owner": "PW1-SILAS-DANE",
                "massKg": 2,
                "location": "HAND",
                "condition": 100,
                "charge": 3,
                "capacity": 4,
                "visible": true,
                "pieces": [
                  {
                    "id": "PW1-SILAS-CHARGE-1",
                    "state": "SPENT"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-2",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-3",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-4",
                    "state": "CHARGED"
                  }
                ]
              },
              "screen": {
                "id": "PW1-SILAS-SCREEN",
                "sourceId": "PW1-SILAS-OWNED-SCREEN-1",
                "owner": "PW1-SILAS-DANE",
                "coordinate": 5,
                "hood": "OPEN",
                "durability": 100,
                "operations": 0
              }
            },
            "conditionVersionBefore": 1,
            "conditionVersionAfter": 1,
            "atSeconds": 29,
            "elapsedSeconds": 5,
            "travelMetres": 0,
            "travelPath": [
              6
            ],
            "lateralTravelPath": [
              0
            ],
            "randomCursorBefore": 376,
            "randomCursorAfter": 377,
            "playerMindAfter": 100,
            "playerSpiritualityAfter": 112,
            "enemyMindAfter": 100,
            "enemySpiritualityAfter": 99
          },
          {
            "order": 6,
            "actor": "PLAYER",
            "id": "sun.s8.light",
            "planned": "sun.s8.light",
            "selectedAbility": "sun.s8.light",
            "fallbackReason": null,
            "label": "继承有限日光。意志检定36，成功。仅当次有限实际效果，未建立跨轮免费能力。 实际5秒，条件1，本人灵性112、精神100，对手灵性99。",
            "selfGain": 12.784200000000002,
            "enemyReduction": 0,
            "threatens": true,
            "mentalPressure": false,
            "attackKind": "BODY",
            "lightEffect": true,
            "rawContribution": 12.784200000000002,
            "rawReduction": 0,
            "paidCost": 0,
            "mindCost": 0,
            "physicalFactor": 1,
            "check": {
              "ability": "will",
              "baseAbility": 30,
              "modifiers": [],
              "effectiveAbility": 30,
              "difficulty": 14,
              "chance": 82,
              "roll": 36,
              "tier": "SUCCESS"
            },
            "resistanceRoll": 52,
            "resistanceChance": 30,
            "succeeded": true,
            "finiteResult": "APPLIED",
            "windowsBefore": {
              "focusedPurification": null,
              "warmRadianceGuard": null,
              "notarization": null,
              "limitedLight": null,
              "enemyWard": null
            },
            "windowsAfter": {
              "focusedPurification": null,
              "warmRadianceGuard": null,
              "notarization": null,
              "limitedLight": null,
              "enemyWard": null
            },
            "pendingBefore": {
              "id": "bard-rebuild-natural:PW1-PENDING:1:3",
              "planned": "ACCIDENT",
              "actual": "ACCIDENT",
              "declaredAt": 34,
              "observedAt": 34,
              "observationSeconds": 0,
              "conditionVersion": 1,
              "visible": true,
              "bodyImpact": false
            },
            "pendingAfter": {
              "id": "bard-rebuild-natural:PW1-PENDING:1:3",
              "planned": "ACCIDENT",
              "actual": "ACCIDENT",
              "declaredAt": 34,
              "observedAt": 34,
              "observationSeconds": 0,
              "conditionVersion": 1,
              "visible": true,
              "bodyImpact": false
            },
            "masteryApplied": [
              "sun.s8.light"
            ],
            "countered": [],
            "rodChargeSpent": 0,
            "chargePieceId": null,
            "materialsBefore": {
              "weapon": {
                "id": "PW1-SILAS-ROD",
                "sourceId": "PW1-SILAS-OWNED-ROD-1",
                "owner": "PW1-SILAS-DANE",
                "massKg": 2,
                "location": "HAND",
                "condition": 100,
                "charge": 3,
                "capacity": 4,
                "visible": true,
                "pieces": [
                  {
                    "id": "PW1-SILAS-CHARGE-1",
                    "state": "SPENT"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-2",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-3",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-4",
                    "state": "CHARGED"
                  }
                ]
              },
              "screen": {
                "id": "PW1-SILAS-SCREEN",
                "sourceId": "PW1-SILAS-OWNED-SCREEN-1",
                "owner": "PW1-SILAS-DANE",
                "coordinate": 5,
                "hood": "OPEN",
                "durability": 100,
                "operations": 0
              }
            },
            "materialsAfter": {
              "weapon": {
                "id": "PW1-SILAS-ROD",
                "sourceId": "PW1-SILAS-OWNED-ROD-1",
                "owner": "PW1-SILAS-DANE",
                "massKg": 2,
                "location": "HAND",
                "condition": 100,
                "charge": 3,
                "capacity": 4,
                "visible": true,
                "pieces": [
                  {
                    "id": "PW1-SILAS-CHARGE-1",
                    "state": "SPENT"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-2",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-3",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-4",
                    "state": "CHARGED"
                  }
                ]
              },
              "screen": {
                "id": "PW1-SILAS-SCREEN",
                "sourceId": "PW1-SILAS-OWNED-SCREEN-1",
                "owner": "PW1-SILAS-DANE",
                "coordinate": 5,
                "hood": "OPEN",
                "durability": 100,
                "operations": 0
              }
            },
            "conditionVersionBefore": 1,
            "conditionVersionAfter": 1,
            "atSeconds": 34,
            "elapsedSeconds": 5,
            "travelMetres": 0,
            "travelPath": [
              4
            ],
            "lateralTravelPath": [
              0
            ],
            "randomCursorBefore": 379,
            "randomCursorAfter": 381,
            "playerMindAfter": 100,
            "playerSpiritualityAfter": 112,
            "enemyMindAfter": 100,
            "enemySpiritualityAfter": 99
          },
          {
            "order": 7,
            "actor": "ENEMY",
            "id": "ACCIDENT",
            "planned": "ACCIDENT",
            "selectedAbility": "ACCIDENT",
            "fallbackReason": null,
            "label": "对手判断偏差，−22.5，不重抽。 实际5秒，条件1，本人灵性112、精神100，对手灵性99。",
            "selfGain": -22.5,
            "enemyReduction": 0,
            "threatens": false,
            "mentalPressure": false,
            "attackKind": "NONE",
            "lightEffect": false,
            "rawContribution": -22.5,
            "rawReduction": 0,
            "paidCost": 0,
            "mindCost": 0,
            "physicalFactor": 1,
            "check": null,
            "resistanceRoll": null,
            "resistanceChance": null,
            "succeeded": false,
            "finiteResult": "NONE",
            "windowsBefore": {
              "focusedPurification": null,
              "warmRadianceGuard": null,
              "notarization": null,
              "limitedLight": null,
              "enemyWard": null
            },
            "windowsAfter": {
              "focusedPurification": null,
              "warmRadianceGuard": null,
              "notarization": null,
              "limitedLight": null,
              "enemyWard": null
            },
            "pendingBefore": {
              "id": "bard-rebuild-natural:PW1-PENDING:1:3",
              "planned": "ACCIDENT",
              "actual": "ACCIDENT",
              "declaredAt": 34,
              "observedAt": 34,
              "observationSeconds": 0,
              "conditionVersion": 1,
              "visible": true,
              "bodyImpact": false
            },
            "pendingAfter": null,
            "masteryApplied": [],
            "countered": [],
            "rodChargeSpent": 0,
            "chargePieceId": null,
            "materialsBefore": {
              "weapon": {
                "id": "PW1-SILAS-ROD",
                "sourceId": "PW1-SILAS-OWNED-ROD-1",
                "owner": "PW1-SILAS-DANE",
                "massKg": 2,
                "location": "HAND",
                "condition": 100,
                "charge": 3,
                "capacity": 4,
                "visible": true,
                "pieces": [
                  {
                    "id": "PW1-SILAS-CHARGE-1",
                    "state": "SPENT"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-2",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-3",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-4",
                    "state": "CHARGED"
                  }
                ]
              },
              "screen": {
                "id": "PW1-SILAS-SCREEN",
                "sourceId": "PW1-SILAS-OWNED-SCREEN-1",
                "owner": "PW1-SILAS-DANE",
                "coordinate": 5,
                "hood": "OPEN",
                "durability": 100,
                "operations": 0
              }
            },
            "materialsAfter": {
              "weapon": {
                "id": "PW1-SILAS-ROD",
                "sourceId": "PW1-SILAS-OWNED-ROD-1",
                "owner": "PW1-SILAS-DANE",
                "massKg": 2,
                "location": "HAND",
                "condition": 100,
                "charge": 3,
                "capacity": 4,
                "visible": true,
                "pieces": [
                  {
                    "id": "PW1-SILAS-CHARGE-1",
                    "state": "SPENT"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-2",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-3",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-4",
                    "state": "CHARGED"
                  }
                ]
              },
              "screen": {
                "id": "PW1-SILAS-SCREEN",
                "sourceId": "PW1-SILAS-OWNED-SCREEN-1",
                "owner": "PW1-SILAS-DANE",
                "coordinate": 5,
                "hood": "OPEN",
                "durability": 100,
                "operations": 0
              }
            },
            "conditionVersionBefore": 1,
            "conditionVersionAfter": 1,
            "atSeconds": 39,
            "elapsedSeconds": 5,
            "travelMetres": 0,
            "travelPath": [
              6
            ],
            "lateralTravelPath": [
              0
            ],
            "randomCursorBefore": 381,
            "randomCursorAfter": 381,
            "playerMindAfter": 100,
            "playerSpiritualityAfter": 112,
            "enemyMindAfter": 100,
            "enemySpiritualityAfter": 99
          },
          {
            "order": 8,
            "actor": "PLAYER",
            "id": "sun.s1.warm-radiance-guard",
            "planned": "sun.s1.warm-radiance-guard",
            "selectedAbility": "sun.s1.warm-radiance-guard",
            "fallbackReason": null,
            "label": "建立一次只待随后实际可见身体冲击使用的有限护持。知识检定90，失败。 实际5秒，条件1，本人灵性106、精神98，对手灵性99。",
            "selfGain": 0,
            "enemyReduction": 0,
            "threatens": false,
            "mentalPressure": false,
            "attackKind": "NONE",
            "lightEffect": false,
            "rawContribution": 0,
            "rawReduction": 0,
            "paidCost": 6,
            "mindCost": 2,
            "physicalFactor": 1,
            "check": {
              "ability": "knowledge",
              "baseAbility": 25,
              "modifiers": [],
              "effectiveAbility": 25,
              "difficulty": 18,
              "chance": 64,
              "roll": 90,
              "tier": "FAILURE"
            },
            "resistanceRoll": null,
            "resistanceChance": null,
            "succeeded": false,
            "finiteResult": "FAILED",
            "windowsBefore": {
              "focusedPurification": null,
              "warmRadianceGuard": null,
              "notarization": null,
              "limitedLight": null,
              "enemyWard": null
            },
            "windowsAfter": {
              "focusedPurification": null,
              "warmRadianceGuard": null,
              "notarization": null,
              "limitedLight": null,
              "enemyWard": null
            },
            "pendingBefore": null,
            "pendingAfter": null,
            "masteryApplied": [],
            "countered": [],
            "rodChargeSpent": 0,
            "chargePieceId": null,
            "materialsBefore": {
              "weapon": {
                "id": "PW1-SILAS-ROD",
                "sourceId": "PW1-SILAS-OWNED-ROD-1",
                "owner": "PW1-SILAS-DANE",
                "massKg": 2,
                "location": "HAND",
                "condition": 100,
                "charge": 3,
                "capacity": 4,
                "visible": true,
                "pieces": [
                  {
                    "id": "PW1-SILAS-CHARGE-1",
                    "state": "SPENT"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-2",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-3",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-4",
                    "state": "CHARGED"
                  }
                ]
              },
              "screen": {
                "id": "PW1-SILAS-SCREEN",
                "sourceId": "PW1-SILAS-OWNED-SCREEN-1",
                "owner": "PW1-SILAS-DANE",
                "coordinate": 5,
                "hood": "OPEN",
                "durability": 100,
                "operations": 0
              }
            },
            "materialsAfter": {
              "weapon": {
                "id": "PW1-SILAS-ROD",
                "sourceId": "PW1-SILAS-OWNED-ROD-1",
                "owner": "PW1-SILAS-DANE",
                "massKg": 2,
                "location": "HAND",
                "condition": 100,
                "charge": 3,
                "capacity": 4,
                "visible": true,
                "pieces": [
                  {
                    "id": "PW1-SILAS-CHARGE-1",
                    "state": "SPENT"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-2",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-3",
                    "state": "CHARGED"
                  },
                  {
                    "id": "PW1-SILAS-CHARGE-4",
                    "state": "CHARGED"
                  }
                ]
              },
              "screen": {
                "id": "PW1-SILAS-SCREEN",
                "sourceId": "PW1-SILAS-OWNED-SCREEN-1",
                "owner": "PW1-SILAS-DANE",
                "coordinate": 5,
                "hood": "OPEN",
                "durability": 100,
                "operations": 0
              }
            },
            "conditionVersionBefore": 1,
            "conditionVersionAfter": 1,
            "atSeconds": 44,
            "elapsedSeconds": 5,
            "travelMetres": 0,
            "travelPath": [
              4
            ],
            "lateralTravelPath": [
              0
            ],
            "randomCursorBefore": 382,
            "randomCursorAfter": 383,
            "playerMindAfter": 98,
            "playerSpiritualityAfter": 106,
            "enemyMindAfter": 100,
            "enemySpiritualityAfter": 99
          }
        ],
        "expiredWindows": [],
        "pendingAfter": null,
        "windowsAfter": {
          "focusedPurification": null,
          "warmRadianceGuard": null,
          "notarization": null,
          "limitedLight": null,
          "enemyWard": null
        },
        "materialsAfter": {
          "weapon": {
            "id": "PW1-SILAS-ROD",
            "sourceId": "PW1-SILAS-OWNED-ROD-1",
            "owner": "PW1-SILAS-DANE",
            "massKg": 2,
            "location": "FORECOURT",
            "condition": 100,
            "charge": 3,
            "capacity": 4,
            "visible": true,
            "pieces": [
              {
                "id": "PW1-SILAS-CHARGE-1",
                "state": "SPENT"
              },
              {
                "id": "PW1-SILAS-CHARGE-2",
                "state": "CHARGED"
              },
              {
                "id": "PW1-SILAS-CHARGE-3",
                "state": "CHARGED"
              },
              {
                "id": "PW1-SILAS-CHARGE-4",
                "state": "CHARGED"
              }
            ]
          },
          "screen": {
            "id": "PW1-SILAS-SCREEN",
            "sourceId": "PW1-SILAS-OWNED-SCREEN-1",
            "owner": "PW1-SILAS-DANE",
            "coordinate": 5,
            "hood": "OPEN",
            "durability": 100,
            "operations": 0
          }
        }
      }
    }
  ],
  "bottles": [
    {
      "id": "pure-white-angel-potion-1",
      "source": "独立公共音乐室导师米瑞尔·赫斯介绍的独立供货处初始批次第1瓶序列1纯白天使成品魔药，独立封存编号pure-white-angel-potion-1。本瓶单独交付与耗用，不改装或补回以前已耗尽的原瓶。",
      "stockedWeek": null,
      "labourSteps": 5,
      "acquiredWeek": 186,
      "consumedWeek": 186,
      "preparationWeek": 186,
      "status": "CONSUMED",
      "outcome": "GREAT_SUCCESS"
    },
    {
      "id": "pure-white-angel-potion-2",
      "source": "独立公共音乐室导师米瑞尔·赫斯介绍的独立供货处初始批次第2瓶序列1纯白天使成品魔药，独立封存编号pure-white-angel-potion-2。本瓶单独交付与耗用，不改装或补回以前已耗尽的原瓶。",
      "stockedWeek": null,
      "labourSteps": 0,
      "acquiredWeek": null,
      "consumedWeek": null,
      "preparationWeek": null,
      "status": "SUPPLIER",
      "outcome": null
    },
    {
      "id": "pure-white-angel-potion-3",
      "source": "独立公共音乐室导师米瑞尔·赫斯介绍的独立供货处初始批次第3瓶序列1纯白天使成品魔药，独立封存编号pure-white-angel-potion-3。本瓶单独交付与耗用，不改装或补回以前已耗尽的原瓶。",
      "stockedWeek": null,
      "labourSteps": 0,
      "acquiredWeek": null,
      "consumedWeek": null,
      "preparationWeek": null,
      "status": "SUPPLIER",
      "outcome": null
    }
  ]
}
;

export function actualPureWhiteAngelEvidence(): PureWhiteAngelCaptureEvidence {
  return PURE_WHITE_ANGEL_CAPTURE_EVIDENCE;
}
