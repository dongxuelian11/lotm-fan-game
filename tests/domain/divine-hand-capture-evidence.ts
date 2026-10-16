/** Literal observations from the frozen297-command capture. The first70 commands
 * inherit a directed S3 setup; this is not a natural9→1 claim. No current schema
 * number is stored here: raw195 and historical173/150/159 remain evidence. */
export const DIVINE_HAND_CAPTURE_EVIDENCE = {
  "sourceSha256": "2b29e549f4ef5b51f99267df946cbce2e9a4cdd674770b01b5568d5e13f24dc6",
  "producerSha256": "5bdaf4e2ba9ba3e4fc47ccac3fd30a54d478be0e4f06b3d120cb31273a98947c",
  "metadataHashes": {
    "natural.json": "0bc387a501ff6f7307e4ca518286e1e7f37bc051fa9676346241155e9cf3c595",
    "summary.json": "5aa9ea725906f9b0202d27abb16bdb584c6ec340cf9ad09d478c7d2e6eec01de",
    "capture-integrity.json": "5ff16c048d43634053e9d65e0a8b8a49177ec5ada61bef16f0a0115ea664fa8e",
    "commands.jsonl": "5834bfc4387ea0c90c4544befdec492e7c7e7ac81c1eade71ca7c741f245e909",
    "public.jsonl": "42239ee473eb48c5710bb973eba9c4b44fd4ac361dc63f8d4eea27b11a9e85d8",
    "source-prefix.json": "bc83497c6e8e37ed6fd18637fd2e317177f55d1da1b57ecd4fa18a96d2bdd959",
    "boundaries.index.json": "05bbbd749f45f9fd305d63c40db7b89583044bbd088922073eaaebb37be5d432",
    "boundaries.steps.json": "1ef1807fdde25cd895b69762b5c4098c57870fa83405557757ed6429060fb478",
    "transitions.json": "c78e857127e0497d6166b1675230eea6b3f380529d9be057c2c92160a41b5738"
  },
  "rawInitialSha256": "32354c25ebb5732de086931c281bc0024b6d718e418ecc21e0e22ab50a42ccf8",
  "rawSourceStateSha256": "cda5ff7de555a5b26ed93d3c2a2403a784aa8d66a8eba09cc1523f2656c08629",
  "rawSourceStateSortedSha256": "55443be90a1d0c0467608b192e7997c19c34d5079a612956ecf7e38a3b7fb4a7",
  "rawRootHashes": {
    "warrior": "8178c4e11eea61c193e48e7625f01b495eea253987981be3450a30ded919e431",
    "gladiator": "e9aa9fd24063d4b0117848ae1129a050f493d1232fb3fa1e1cf49b0cf0df300b",
    "weaponmaster": "057f5b4efbee719b7a3d3323d60d612bc2b80c168ff121f60152079041ec4690",
    "dawnPaladin": "efbd9e46da3a949cd5d6cbda18240cf697044b36008f86f79e9d2ef685d17b33",
    "guardian": "e55e23028353f13004bc97935630f93cc765965d578bbb8ae84c69570984a0cc",
    "demonHunter": "94def24c1b02202fa04075ac40140f15bf194a75b8b016ea1f2eff7199f9fdf6",
    "silverKnight": "453ed7c4ccae535f9065965e4d23e1211f9b99bbf4bf441a20e4a5d07c3d6feb",
    "glory": "89e2f8a98997e41404de1cefaf157ad0ff094ccd72c2b6a0c76fe4a4f377e510"
  },
  "rawFinalSha256": "8fbec07b18ed52d851fa1eb2403fc5c2ca64cb756140038cc35ec9ef1181c8cb",
  "rawPrefixFinalSha256": "1908adb35d936bd5651ef7cd1ca9cbeffc55e3b3568ee21ff5798741ab3a2332",
  "prefixSha256": "666b55baf07fca58e11290cdc86d54702cb9f28d0c87957bb483427ff3bfb8fe",
  "preserved": [
    {
      "file": "tests/fixtures/silver-knight-v01520/directed.json",
      "sha256": "acab010a42b95613657f19435436a435e7971b8ed6f9381850e852af89ac7cc2",
      "commands": 70,
      "status": "ACTIVE",
      "rawSchemaVersion": 150,
      "rawContentVersion": "silver-knight-v150",
      "rawFinalSha256": "feafcae331f30f42a4a9169f8acccbad13b10cf12665f49fa00db54f081259d3",
      "finalStatus": "ACTIVE",
      "health": 30,
      "week": 128,
      "revision": 512,
      "random": {
        "seed": "warrior-natural-v042",
        "cursor": 440
      }
    },
    {
      "file": "tests/fixtures/silver-knight-v01520/natural.json",
      "sha256": "69f6b9361693c203ef26329d51dd0e78b726e4e2f26973cadd8314f18997fa69",
      "commands": 380,
      "status": "ACTIVE",
      "rawSchemaVersion": 150,
      "rawContentVersion": "silver-knight-v150",
      "rawFinalSha256": "7166ebe51a66c03d1faacc85afee1cafabcdd3903c7c1d714d82040d61d43f70",
      "finalStatus": "ACTIVE",
      "health": 100,
      "week": 106,
      "revision": 381,
      "random": {
        "seed": "warrior-natural-v042",
        "cursor": 167
      }
    },
    {
      "file": "tests/fixtures/preparation-audit-v01630/silver-natural.json",
      "sha256": "11726b7f88373fc1ed129c55d652dc16449d2b633b44d39ca8ffc050618922bc",
      "commands": 425,
      "status": "DEAD",
      "rawSchemaVersion": 159,
      "rawContentVersion": "coffin-bearer-v159",
      "rawFinalSha256": "f195b898162318cde8d0e69a2df4479a96cd62e4f0de699dc395c3d989355efb",
      "finalStatus": "DEAD",
      "health": 0,
      "week": 116,
      "revision": 426,
      "random": {
        "seed": "warrior-natural-v042",
        "cursor": 303
      }
    },
    {
      "file": "tests/fixtures/preparation-audit-v01630/silver-v2-natural.json",
      "sha256": "cb359bf364b8cb3b853073275d26a31e6b446982cf968bc12ec23bf5c9e6d5cb",
      "commands": 476,
      "status": "DEAD",
      "rawSchemaVersion": 159,
      "rawContentVersion": "coffin-bearer-v159",
      "rawFinalSha256": "727e2431d9527467ec5014910944cacaddd9912a99a7cf8ae95e95d664a6add8",
      "finalStatus": "DEAD",
      "health": 0,
      "week": 123,
      "revision": 477,
      "random": {
        "seed": "warrior-natural-v042",
        "cursor": 608
      }
    }
  ],
  "commandCount": 297,
  "boundaryNames": 142,
  "uniqueBoundaryFiles": 140,
  "uniqueBoundaryBytes": 140,
  "uniqueBoundaryFinalStates": 140,
  "stage": "ACTUAL_TERMINAL_WITH_DIRECTED70_HISTORY",
  "error": null,
  "provenance": {
    "kind": "DIRECTED70_EXACT158_PUBLIC_GLORY_THEN_PUBLIC_DIVINE_HAND",
    "prior": "DIRECTED: six explicit RNG-cursor selections for actual combat death branches plus angel response and dose success. No natural advancement claim. Every selected boundary and subsequent public transition is preserved; old natural two surrendered bodies stay alive.",
    "priorContinuation": {
      "kind": "DIRECTED_SILVER_KNIGHT_PREFIX_THEN_PUBLIC_GLORY",
      "sourceFixture": "tests/fixtures/silver-knight-v01520/directed.json",
      "preservedSourceFixtures": [
        "tests/fixtures/silver-knight-v01520/natural.json",
        "tests/fixtures/preparation-audit-v01630/silver-natural.json",
        "tests/fixtures/preparation-audit-v01630/silver-v2-natural.json"
      ],
      "prefixStartingPoint": "Original directed startingState",
      "exactPublicPrefixCommands": 70,
      "sourceS3Setup": "DIRECTED",
      "fullNaturalS9ToS2": false,
      "newRandomChanges": false,
      "policy": "One public continuation from the original directed S3 history. Actual clinic and later rest; finite ordinary work/rest and independent bottles. Three one-shot cases with ordinary fallback; one optional fight, DEFEND/CONTROL/ATTACK cycle, permanent RETREAT at H<=40 or first new HEAVY injury, at most 90 rounds. No rerun for a better outcome."
    },
    "source": "tests/fixtures/glory-v01760/natural.json",
    "sourceSha256": "2b29e549f4ef5b51f99267df946cbce2e9a4cdd674770b01b5568d5e13f24dc6",
    "sourceRoot": "final",
    "inheritedDirectedPrefix": true,
    "fullNaturalS9ToS1": false,
    "newRandomChanges": false,
    "preserved": [
      {
        "file": "tests/fixtures/silver-knight-v01520/directed.json",
        "sha256": "acab010a42b95613657f19435436a435e7971b8ed6f9381850e852af89ac7cc2",
        "commands": 70,
        "status": "ACTIVE"
      },
      {
        "file": "tests/fixtures/silver-knight-v01520/natural.json",
        "sha256": "69f6b9361693c203ef26329d51dd0e78b726e4e2f26973cadd8314f18997fa69",
        "commands": 380,
        "status": "ACTIVE"
      },
      {
        "file": "tests/fixtures/preparation-audit-v01630/silver-natural.json",
        "sha256": "11726b7f88373fc1ed129c55d652dc16449d2b633b44d39ca8ffc050618922bc",
        "commands": 425,
        "status": "DEAD"
      },
      {
        "file": "tests/fixtures/preparation-audit-v01630/silver-v2-natural.json",
        "sha256": "cb359bf364b8cb3b853073275d26a31e6b446982cf968bc12ec23bf5c9e6d5cb",
        "commands": 476,
        "status": "DEAD"
      }
    ]
  },
  "strategy": {
    "source": "EXACT158_LIVING_FINAL_WITH_DIRECTED70_HISTORY",
    "sourceSeed": "warrior-natural-v042",
    "sourceCursor": 475,
    "caseMethod": "ABILITY",
    "caseRoute": "CURRENT_PUBLIC_PREFERRED_ACTION_ONCE_EACH_WITH_ORDINARY_COMPLETION_IF_POWER_FAILS",
    "encounterPolicy": "ALL",
    "combatStance": "CONTROL",
    "combatRoundCap": 90,
    "potionAttemptCap": 12,
    "maxCommands": 3500,
    "ordinaryPreparationCap": 600,
    "sourceInjuryRecovery": "ACTUAL_ORDINARY_REST_FOR_SINGLE_LIGHT_WOUND",
    "ordinaryActions": "WORK_ONCE_PER_WEEK_THEN_REST",
    "recovery": {
      "health": 100,
      "mind": 100,
      "spirituality": 120,
      "pollution": 0
    },
    "energyBeforeCase": 9,
    "energyBeforeEncounter": 12,
    "eventChoices": {
      "ORIGIN": ".decline",
      "LIFE-BILL-01": "PAY_PART",
      "DEBT-NOTICE-01": "DECLINE",
      "DEBT-SETTLE-01": "DEFER",
      "LIFE-CARE-01": "PAY",
      "CARE-WORK-OFFER": "DECLINE"
    }
  },
  "snapshots": [
    "departure",
    "sourceRecovered",
    "guidance",
    "promoted",
    "practiced",
    "recoveredBeforeEncounter",
    "combatStart",
    "actualTerminal"
  ],
  "final": {
    "status": "DEAD",
    "revision": 739,
    "week": 175,
    "date": {
      "epoch": "FIFTH_EPOCH",
      "year": 1352,
      "month": 10,
      "day": 28
    },
    "H": 0,
    "M": 96,
    "S": 120,
    "cash": 845,
    "AP": 0,
    "pollution": 0,
    "injuries": [
      {
        "id": "warrior-rebuild-natural:combat:1:PLAYER:733:0",
        "severity": "HEAVY",
        "acquiredRevision": 733,
        "treatedRevision": null
      },
      {
        "id": "warrior-rebuild-natural:combat:2:PLAYER:734:1",
        "severity": "HEAVY",
        "acquiredRevision": 734,
        "treatedRevision": null
      },
      {
        "id": "warrior-rebuild-natural:combat:3:PLAYER:735:2",
        "severity": "LIGHT",
        "acquiredRevision": 735,
        "treatedRevision": null
      },
      {
        "id": "warrior-rebuild-natural:combat:5:PLAYER:737:3",
        "severity": "LIGHT",
        "acquiredRevision": 737,
        "treatedRevision": null
      },
      {
        "id": "warrior-rebuild-natural:combat:7:PLAYER:739:4",
        "severity": "HEAVY",
        "acquiredRevision": 739,
        "treatedRevision": null
      }
    ],
    "injuryRisk": 4,
    "random": {
      "seed": "warrior-natural-v042",
      "cursor": 558
    },
    "mastery": {
      "warrior.s9.physique": 24,
      "warrior.s9.arms": 33,
      "warrior.s9.restraint": 57,
      "warrior.s8.combat-skill": 16,
      "warrior.s7.weapons": 8,
      "warrior.s7.weak-point": 8,
      "warrior.s6.dawn-light": 0,
      "warrior.s6.dawn-armor": 41,
      "warrior.s6.dawn-weapon": 8,
      "warrior.s6.light-storm": 0,
      "warrior.s5.guard-state": 0,
      "warrior.s5.damage-sharing": 0,
      "warrior.s4.discern-corruption": 8,
      "warrior.s4.targeted-preparation": 33,
      "warrior.s4.veil-intent": 8,
      "warrior.s3.silver-armor": 8,
      "warrior.s3.light-concealment": 8,
      "warrior.s3.silver-thrust": 8,
      "warrior.s2.armor-temper": 8,
      "warrior.s2.close-guard": 16,
      "warrior.s1.beam-stabilize": 0,
      "warrior.s1.armor-convergence": 8
    },
    "sequence": 1,
    "acting": 100
  },
  "originalCharacter": {
    "name": "莱恩",
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
      "physique": 34,
      "perception": 24,
      "will": 25,
      "knowledge": 22
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
  "finalFinance": {
    "weeklyBudget": 3,
    "lifeTier": "DESTITUTE",
    "nextLifeTier": "DESTITUTE",
    "debts": [
      {
        "id": "debt-12-45-0",
        "source": "生活应付款",
        "remaining": 0,
        "weeklyPayment": 30,
        "createdWeek": 12
      },
      {
        "id": "debt-22-82-1",
        "source": "生活应付款",
        "remaining": 0,
        "weeklyPayment": 30,
        "createdWeek": 22
      },
      {
        "id": "debt-23-86-2",
        "source": "生活应付款",
        "remaining": 0,
        "weeklyPayment": 30,
        "createdWeek": 23
      },
      {
        "id": "debt-24-90-3",
        "source": "生活应付款",
        "remaining": 0,
        "weeklyPayment": 30,
        "createdWeek": 24
      },
      {
        "id": "debt-158-641-4",
        "source": "生活应付款",
        "remaining": 0,
        "weeklyPayment": 30,
        "createdWeek": 158
      }
    ],
    "missedWeeks": 0,
    "credit": "NORMAL"
  },
  "acquisitionChecks": [
    [
      {
        "type": "CONSUME",
        "bottleId": "divine-hand-potion-1",
        "confirmed": true
      },
      157,
      61,
      40,
      "FAILURE",
      475,
      476
    ],
    [
      {
        "type": "CONSUME",
        "bottleId": "divine-hand-potion-2",
        "confirmed": true
      },
      167,
      18,
      40,
      "SUCCESS",
      476,
      477
    ]
  ],
  "lifeChecks": [
    [
      "BEAM_STABILIZE",
      23,
      99,
      60,
      "GREAT_FAILURE",
      477,
      478
    ],
    [
      "MANUAL_INSPECTION",
      23,
      8,
      64,
      "SUCCESS",
      478,
      479
    ],
    [
      "ARMOR_CONVERGENCE",
      26,
      89,
      66,
      "FAILURE",
      479,
      480
    ],
    [
      "BEAM_STABILIZE",
      23,
      65,
      60,
      "FAILURE",
      480,
      481
    ]
  ],
  "lifeResults": {
    "beam-support": {
      "status": "RESOLVED",
      "result": "ORDINARY",
      "returned": true,
      "attempts": [
        {
          "week": 169,
          "method": "ABILITY",
          "closed": true,
          "result": "ORDINARY",
          "elapsedSeconds": 34,
          "playerTravelMetres": 8,
          "celiaTravelMetres": 8,
          "evanTravelMetres": 8,
          "playerEnergySpent": 9,
          "penniesSpent": 20,
          "spiritualitySpent": 8,
          "mindSpent": 2,
          "healthSpent": 0,
          "permission": {
            "owner": "CLOSED",
            "operator": "CLOSED",
            "participant": "CLOSED",
            "ability": "CLOSED"
          },
          "permissionVersion": 4,
          "approached": true,
          "contact": false,
          "stopped": false,
          "exited": true,
          "inspectionAt": 316,
          "inspectionTier": "SUCCESS",
          "inspectionBonus": 0,
          "load": null,
          "padRetrieved": false,
          "padReturned": false,
          "armorWear": 0,
          "impactDamage": 0,
          "impactReduction": 0,
          "beam": {
            "attempts": 1,
            "successes": 0,
            "effects": 0,
            "tier": "GREAT_FAILURE",
            "state": "FAILED"
          },
          "armor": {
            "attempts": 0,
            "successes": 0,
            "effects": 0,
            "tier": null,
            "state": "NONE"
          }
        }
      ]
    },
    "armor-window": {
      "status": "RESOLVED",
      "result": "ORDINARY",
      "returned": true,
      "attempts": [
        {
          "week": 171,
          "method": "ABILITY",
          "closed": true,
          "result": "ORDINARY",
          "elapsedSeconds": 40,
          "playerTravelMetres": 8,
          "celiaTravelMetres": 8,
          "evanTravelMetres": 8,
          "playerEnergySpent": 9,
          "penniesSpent": 50,
          "spiritualitySpent": 8,
          "mindSpent": 2,
          "healthSpent": 6,
          "permission": {
            "owner": "CLOSED",
            "operator": "CLOSED",
            "participant": "CLOSED",
            "ability": "CLOSED"
          },
          "permissionVersion": 4,
          "approached": true,
          "contact": false,
          "stopped": false,
          "exited": true,
          "inspectionAt": null,
          "inspectionTier": null,
          "inspectionBonus": 0,
          "load": {
            "id": "DH1-LOAD:armor-window:1",
            "ownerId": "GL2-CELIA",
            "paidPennies": 30,
            "boughtWeek": 171,
            "location": "BENCH",
            "arrivedAt": 355,
            "preparedAt": 356,
            "kilograms": 12,
            "remaining": 0,
            "consumed": 1,
            "appliedAt": 359,
            "safetyStop": "ENGAGED"
          },
          "padRetrieved": true,
          "padReturned": true,
          "armorWear": 5,
          "impactDamage": 6,
          "impactReduction": 0,
          "beam": {
            "attempts": 0,
            "successes": 0,
            "effects": 0,
            "tier": null,
            "state": "NONE"
          },
          "armor": {
            "attempts": 1,
            "successes": 0,
            "effects": 0,
            "tier": "FAILURE",
            "state": "FAILED"
          }
        }
      ]
    },
    "withdrawn-support": {
      "status": "RESOLVED",
      "result": "ORDINARY",
      "returned": true,
      "attempts": [
        {
          "week": 173,
          "method": "ABILITY",
          "closed": true,
          "result": "ORDINARY",
          "elapsedSeconds": 33,
          "playerTravelMetres": 8,
          "celiaTravelMetres": 8,
          "evanTravelMetres": 8,
          "playerEnergySpent": 8,
          "penniesSpent": 20,
          "spiritualitySpent": 8,
          "mindSpent": 2,
          "healthSpent": 0,
          "permission": {
            "owner": "CLOSED",
            "operator": "CLOSED",
            "participant": "WITHDRAWN",
            "ability": "CLOSED"
          },
          "permissionVersion": 5,
          "approached": true,
          "contact": false,
          "stopped": true,
          "exited": true,
          "inspectionAt": null,
          "inspectionTier": null,
          "inspectionBonus": 0,
          "load": null,
          "padRetrieved": false,
          "padReturned": false,
          "armorWear": 0,
          "impactDamage": 0,
          "impactReduction": 0,
          "beam": {
            "attempts": 1,
            "successes": 0,
            "effects": 0,
            "tier": "FAILURE",
            "state": "FAILED"
          },
          "armor": {
            "attempts": 0,
            "successes": 0,
            "effects": 0,
            "tier": null,
            "state": "NONE"
          }
        }
      ]
    }
  },
  "lifeAbilityUse": {
    "warrior.s1.beam-stabilize": {
      "attempts": 2,
      "checkSuccesses": 0,
      "actualApplications": 0,
      "states": [
        "FAILED",
        "NONE",
        "FAILED"
      ]
    },
    "warrior.s1.armor-convergence": {
      "attempts": 1,
      "checkSuccesses": 0,
      "actualApplications": 0,
      "states": [
        "NONE",
        "FAILED",
        "NONE"
      ]
    }
  },
  "bottles": [
    {
      "id": "divine-hand-potion-1",
      "source": "贝克兰德神明之手独立成品交接处初始批次第1瓶序列1神明之手成品魔药，独立封存编号divine-hand-potion-1。本瓶单独交付与耗用，不改装旧荣耀者原瓶，也不补回以前耗尽的原瓶。",
      "stockedWeek": null,
      "labourSteps": 5,
      "acquiredWeek": 157,
      "consumedWeek": 157,
      "preparationWeek": 157,
      "status": "CONSUMED",
      "outcome": "FAILURE"
    },
    {
      "id": "divine-hand-potion-2",
      "source": "贝克兰德神明之手独立成品交接处初始批次第2瓶序列1神明之手成品魔药，独立封存编号divine-hand-potion-2。本瓶单独交付与耗用，不改装旧荣耀者原瓶，也不补回以前耗尽的原瓶。",
      "stockedWeek": null,
      "labourSteps": 5,
      "acquiredWeek": 167,
      "consumedWeek": 167,
      "preparationWeek": 167,
      "status": "CONSUMED",
      "outcome": "SUCCESS"
    },
    {
      "id": "divine-hand-potion-3",
      "source": "贝克兰德神明之手独立成品交接处初始批次第3瓶序列1神明之手成品魔药，独立封存编号divine-hand-potion-3。本瓶单独交付与耗用，不改装旧荣耀者原瓶，也不补回以前耗尽的原瓶。",
      "stockedWeek": null,
      "labourSteps": 0,
      "acquiredWeek": null,
      "consumedWeek": null,
      "preparationWeek": null,
      "status": "SUPPLIER",
      "outcome": null
    }
  ],
  "potionOutcomes": [
    "FAILURE",
    "SUCCESS"
  ],
  "lifeJournalSha256": "a4b4648c8f1796a82939dbbba9fc15e6425602b2c81fb65c106c81cc45177a89",
  "sourceHistorySha256": "857f4aff6b242e97dd8f094e46ad95ae42945e634ac97b696d9ee05c75e8f1ec",
  "sourceSceneSha256": "0e63f2940327d76542c52a1d05e80507cc0bd688e9c158f34fdcfa9c9a4a71b6",
  "encounterSha256": "776edf045dd3003928ac32e60775ad64a211a709850d9ca9edf3ba1e73ee7b6a",
  "roundHashes": [
    "93a95a85bbc6bf055f3de46317e11021682e9c24c0616c9f3fe628e10111c0c4",
    "29633ada46ac3502154ad425da0d1be843600248123369769aa16e6005d83e4f",
    "edfe4b1b437018ed8b5676d7ee8c8dd1047759f73d65403a74aadb19b61d9ae2",
    "7900e77aa59a5f893b9e247322d4d0ec1848e216f7c7f89f034cbcb40281e61d",
    "2f7cf1236214fff7a14593ee6a015df02ad7735221e00fca0b3e57523b247302",
    "d55237783c4a385d159c9939e0959fd5fb4d6aedf931efa32d4edba17048cbed",
    "2ed204f652cedca04c332f60263a045af880992cc3682178ba3f73bccbcfcaa0"
  ],
  "currentOriginals": {
    "site": {
      "siteId": "GL2-REPAIR-ROOM",
      "introducedWeek": 138,
      "introducedDate": {
        "epoch": "FIFTH_EPOCH",
        "year": 1352,
        "month": 2,
        "day": 12
      },
      "clockSeconds": 898,
      "playerLocation": "OUTSIDE",
      "playerTravelMetres": 104,
      "playerEnergy": 9,
      "celia": {
        "id": "GL2-CELIA",
        "name": "西莉娅",
        "age": 41,
        "alive": true,
        "location": "OUTSIDE",
        "energy": 56,
        "travelMetres": 44
      },
      "evan": {
        "id": "GL2-EVAN",
        "name": "埃文",
        "age": 36,
        "alive": true,
        "location": "OUTSIDE",
        "energy": 58,
        "travelMetres": 42
      },
      "armor": {
        "id": "SK3-LIFE-ARMOR",
        "owner": "PLAYER",
        "formed": true,
        "active": false,
        "integrity": 50,
        "remainingSeconds": 0
      },
      "armorSource": {
        "root": "silverKnight.life.armor",
        "promotionWeek": 120,
        "introducedWeek": 138,
        "actor": "PLAYER",
        "at": "ENTRY",
        "snapshot": {
          "id": "SK3-LIFE-ARMOR",
          "owner": "PLAYER",
          "formed": true,
          "active": false,
          "integrity": 65,
          "remainingSeconds": 0
        }
      },
      "armorWorn": true,
      "pads": {
        "id": "GL2-PADS",
        "ownerId": "GL2-CELIA",
        "issuedWithPlateId": "GL2-PLATE:armor-temper",
        "location": "BENCH",
        "remaining": 0,
        "consumed": 2,
        "worn": false
      },
      "load": {
        "id": "GL2-LOAD",
        "ownerId": "GL2-CELIA",
        "location": "BENCH",
        "kilograms": 12,
        "remainingLoads": 0,
        "appliedLoads": 1,
        "safetyStop": "ENGAGED"
      },
      "bridge": {
        "id": "GL2-BRIDGE",
        "from": "BENCH",
        "to": "BRIDGE",
        "metres": 6,
        "sidePathMetres": 8,
        "ordinaryPath": "OPEN",
        "crossings": 1,
        "ordinaryCrossings": 1
      },
      "temper": {
        "active": false,
        "expiresAt": null
      },
      "guard": {
        "active": false,
        "actorId": null,
        "expiresAt": null,
        "sharedHealth": 5,
        "sharedEnergy": 5
      },
      "plates": [
        {
          "id": "GL2-PLATE:armor-temper",
          "caseId": "armor-temper",
          "ownerId": "PLAYER",
          "quantity": 1,
          "charges": 0,
          "location": "BENCH",
          "paidPennies": 20,
          "preparedWeek": 140
        },
        {
          "id": "GL2-PLATE:close-guard",
          "caseId": "close-guard",
          "ownerId": "PLAYER",
          "quantity": 1,
          "charges": 0,
          "location": "BENCH",
          "paidPennies": 20,
          "preparedWeek": 141
        },
        {
          "id": "GL2-PLATE:revoked-crossing",
          "caseId": "revoked-crossing",
          "ownerId": "PLAYER",
          "quantity": 1,
          "charges": 1,
          "location": "BENCH",
          "paidPennies": 20,
          "preparedWeek": 144
        }
      ]
    }
  },
  "combatAbilityUse": {
    "warrior.s1.beam-stabilize": {
      "plannedSelections": 1,
      "paidAttempts": 0,
      "successfulChecks": 0,
      "actualApplications": 0
    },
    "warrior.s1.armor-convergence": {
      "plannedSelections": 6,
      "paidAttempts": 2,
      "successfulChecks": 2,
      "actualApplications": 1
    }
  },
  "actualCosts": {
    "acquisitionCash": 3000,
    "acquisitionAP": 16,
    "lifeCash": 105,
    "lifeAP": 8,
    "lifeSpirituality": 24,
    "lifeMind": 6,
    "playerOrdinaryMetres": 24,
    "celiaOrdinaryMetres": 24,
    "evanOrdinaryMetres": 24,
    "playerEnergySpent": 26,
    "playerEnergyRecovered": 20,
    "celiaEnergySpent": 24,
    "evanEnergySpent": 24,
    "combatSpirituality": 22,
    "combatMindCasting": 4,
    "enemySpirituality": 36,
    "ordinaryWorkCount": 24,
    "ordinaryRestCount": 39
  },
  "sqliteRepresentatives": [
    "exact-original158-living-source",
    "actual-rest-for-original-light-wound",
    "paid500-guidance-freezes-eight-roots",
    "consume-divine-hand-potion-1",
    "step-199-event_choice",
    "consume-divine-hand-potion-2",
    "beam-support-beam_stabilize",
    "armor-window-armor_convergence",
    "armor-window-apply_load",
    "withdrawn-support-withdraw_consent",
    "actual-paid-outside-energy-recovery",
    "independent-optional-fight",
    "combat-round-2",
    "combat-round-7"
  ]
};
