import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { createReadStream, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { createInterface } from 'node:readline';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent, assertValidSliceState, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { validateApocalypseDemonessAcquisitionJournal, validateApocalypseDemonessJournalContinuity, validateApocalypseDemonessSource } from '../../src/domain/apocalypse-demoness/index.js';
import { APOCALYPSE_DEMONESS_ABILITY_IDS, APOCALYPSE_DEMONESS_SOURCE_KEYS } from '../../src/domain/apocalypse-demoness/types.js';
import { APOCALYPSE_DEMONESS_CASE_IDS, apocalypseDemonessExpectedOriginals, apocalypseDemonessLifeMasteryGains, validateApocalypseDemonessLifeState } from '../../src/domain/apocalypse-demoness/life.js';
import { apocalypseDemonessEncounterOriginalEvents, validateApocalypseDemonessEncounterState } from '../../src/domain/apocalypse-demoness/encounter.js';
import { replayApocalypseDemonessCombatRound, apocalypseDemonessActionCount, apocalypseDemonessEnemyActionCount } from '../../src/domain/apocalypse-demoness/combat.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';

const ROOT = 'tests/fixtures/apocalypse-demoness-v01990';
const SOURCE = 'tests/fixtures/calamity-demoness-v01770/natural.json';
const PRIOR = 'tests/fixtures/unaging-demoness-v01530/natural.json';
const SOURCE_SHA = 'cffe4b82ef1798b6bd8687b809efd58338692172bf88bebfecc3bd6ededd9932';
const PRIOR_SHA = 'e11152731ee89cb51c4c411864280a9dfb39c8452a33a898d94348f872d8a195';
const PREFIX_SHA = '703861b9fdc6e2c29f5fe173444bb2841f6d46167f7498cef029245b4147404b';
const PREFIX_COUNT = 585, INHERITED_COUNT = 487, SEED = 'assassin-natural-v045';
const expected = {
  "producerSha256": "f5236cc12868c44409760e0c9dba29b8eef95344b360fbecc2bd1cbbd333d174",
  "commands": 854,
  "namedBoundaries": 277,
  "stage": "NATURAL585_PREFIX_PUBLIC_APOCALYPSE_DEMONESS_CONTINUATION",
  "fullNaturalS9ToS1": true,
  "rawFinalSha256": "1ead32819ee06196632d7996f5f1cee5bab5f87d6d5f483ebc7191c2b1c9a904",
  "rawPrefixFinalSha256": "4825610208a558dcbf86e41476ba2998a48dc58d17deb4a29b954870a940c648",
  "strategy": {
    "source": "EXACT585_LIVING_NATURAL_CALAMITY_FINAL",
    "sourceSeed": "assassin-natural-v045",
    "sourceCursor": 207,
    "caseMethod": "ABILITY",
    "caseRoute": "CURRENT_PUBLIC_PREFERRED_ACTION_ONCE_EACH_WITH_ORDINARY_COMPLETION_IF_POWER_FAILS",
    "encounterPolicy": "ALL",
    "combatStance": "CONTROL",
    "combatRoundCap": 90,
    "potionAttemptCap": 12,
    "maxCommands": 3500,
    "ordinaryPreparationCap": 600,
    "sourceInjuryRecovery": "ACTUAL60P_CLINIC_THEN_REST_FOR_ORIGINAL_HEAVY_WOUND",
    "ordinaryActions": "WORK_ONCE_PER_WEEK_THEN_REST",
    "recovery": {
      "health": 100,
      "mind": 100,
      "spirituality": 120,
      "pollution": 0
    },
    "energyBeforeCase": 30,
    "energyBeforeEncounter": 15,
    "eventChoices": {
      "ORIGIN": ".decline",
      "LIFE-BILL-01": "PAY_PART",
      "DEBT-NOTICE-01": "DECLINE",
      "DEBT-SETTLE-01": "DEFER",
      "LIFE-CARE-01": "PAY",
      "CARE-WORK-OFFER": "DECLINE"
    }
  },
  "final": {
    "status": "ACTIVE",
    "revision": 855,
    "week": 210,
    "date": {
      "epoch": "FIFTH_EPOCH",
      "year": 1353,
      "month": 6,
      "day": 30
    },
    "H": 80,
    "M": 96,
    "S": 86,
    "cash": 315,
    "AP": 2,
    "pollution": 0,
    "injuries": [
      {
        "id": "witch-rebuild-natural:combat:2:PLAYER:852:0",
        "severity": "LIGHT",
        "acquiredRevision": 852,
        "treatedRevision": null
      },
      {
        "id": "witch-rebuild-natural:combat:3:PLAYER:853:1",
        "severity": "LIGHT",
        "acquiredRevision": 853,
        "treatedRevision": null
      }
    ],
    "injuryRisk": 1,
    "random": {
      "seed": "assassin-natural-v045",
      "cursor": 273
    },
    "mastery": {
      "assassin.s9.lightness": 32,
      "assassin.s9.vision": 0,
      "assassin.s9.shadow": 32,
      "assassin.s9.burst": 16,
      "assassin.s8.instigation": 50,
      "assassin.s7.black-flame": 0,
      "assassin.s7.frost": 24,
      "assassin.s7.invisibility": 33,
      "assassin.s7.substitute": 33,
      "assassin.s7.divination-interference": 16,
      "assassin.s7.black-magic": 8,
      "assassin.s6.silk-binding": 0,
      "assassin.s6.charm": 0,
      "assassin.s5.disease": 0,
      "assassin.s4.plague": 0,
      "assassin.s3.mirror-passage": 8,
      "assassin.s2.mirror-screen": 8,
      "assassin.s2.black-flame-channel": 24,
      "assassin.s1.pulse-containment": 8,
      "assassin.s1.mirror-buffer": 16
    },
    "sequence": 1,
    "acting": 100
  },
  "originalMastery": {
    "assassin.s9.lightness": 32,
    "assassin.s9.vision": 0,
    "assassin.s9.shadow": 32,
    "assassin.s9.burst": 16,
    "assassin.s8.instigation": 50,
    "assassin.s7.black-flame": 0,
    "assassin.s7.frost": 0,
    "assassin.s7.invisibility": 33,
    "assassin.s7.substitute": 33,
    "assassin.s7.divination-interference": 16,
    "assassin.s7.black-magic": 8,
    "assassin.s6.silk-binding": 0,
    "assassin.s6.charm": 0,
    "assassin.s5.disease": 0,
    "assassin.s4.plague": 0,
    "assassin.s3.mirror-passage": 8,
    "assassin.s2.mirror-screen": 8,
    "assassin.s2.black-flame-channel": 8
  },
  "snapshots": [
    "departure",
    "sourceRecovered",
    "guidance",
    "promoted",
    "practiced",
    "recoveredBeforeEncounter",
    "combatStart",
    "combatTerminal"
  ],
  "bottles": [
    {
      "id": "apocalypse-demoness-potion-1",
      "source": "贝克兰德末日魔女独立成品交接处初始批次第1瓶序列1末日魔女成品魔药，独立封存编号apocalypse-demoness-potion-1。本瓶单独交付与耗用，不改装旧灾难魔女原瓶，也不补回以前耗尽的原瓶。",
      "stockedWeek": null,
      "labourSteps": 5,
      "acquiredWeek": 154,
      "consumedWeek": 154,
      "preparationWeek": 154,
      "status": "CONSUMED",
      "outcome": "FAILURE"
    },
    {
      "id": "apocalypse-demoness-potion-2",
      "source": "贝克兰德末日魔女独立成品交接处初始批次第2瓶序列1末日魔女成品魔药，独立封存编号apocalypse-demoness-potion-2。本瓶单独交付与耗用，不改装旧灾难魔女原瓶，也不补回以前耗尽的原瓶。",
      "stockedWeek": null,
      "labourSteps": 5,
      "acquiredWeek": 163,
      "consumedWeek": 163,
      "preparationWeek": 163,
      "status": "CONSUMED",
      "outcome": "FAILURE"
    },
    {
      "id": "apocalypse-demoness-potion-3",
      "source": "贝克兰德末日魔女独立成品交接处初始批次第3瓶序列1末日魔女成品魔药，独立封存编号apocalypse-demoness-potion-3。本瓶单独交付与耗用，不改装旧灾难魔女原瓶，也不补回以前耗尽的原瓶。",
      "stockedWeek": null,
      "labourSteps": 5,
      "acquiredWeek": 173,
      "consumedWeek": 173,
      "preparationWeek": 173,
      "status": "CONSUMED",
      "outcome": "GREAT_FAILURE"
    },
    {
      "id": "apocalypse-demoness-potion-4",
      "source": "贝克兰德末日魔女独立成品交接处第2批、第175周实际到货的序列1末日魔女成品，独立封存编号apocalypse-demoness-potion-4。本瓶须另行取得并独立耗用。",
      "stockedWeek": 175,
      "labourSteps": 5,
      "acquiredWeek": 183,
      "consumedWeek": 183,
      "preparationWeek": 183,
      "status": "CONSUMED",
      "outcome": "FAILURE"
    },
    {
      "id": "apocalypse-demoness-potion-5",
      "source": "贝克兰德末日魔女独立成品交接处第2批、第175周实际到货的序列1末日魔女成品，独立封存编号apocalypse-demoness-potion-5。本瓶须另行取得并独立耗用。",
      "stockedWeek": 175,
      "labourSteps": 5,
      "acquiredWeek": 193,
      "consumedWeek": 193,
      "preparationWeek": 193,
      "status": "CONSUMED",
      "outcome": "FAILURE"
    },
    {
      "id": "apocalypse-demoness-potion-6",
      "source": "贝克兰德末日魔女独立成品交接处第2批、第175周实际到货的序列1末日魔女成品，独立封存编号apocalypse-demoness-potion-6。本瓶须另行取得并独立耗用。",
      "stockedWeek": 175,
      "labourSteps": 5,
      "acquiredWeek": 202,
      "consumedWeek": 202,
      "preparationWeek": 202,
      "status": "CONSUMED",
      "outcome": "SUCCESS"
    }
  ],
  "treatments": [
    {
      "paidPennies": 60,
      "before": {
        "status": "ACTIVE",
        "revision": 587,
        "week": 143,
        "date": {
          "epoch": "FIFTH_EPOCH",
          "year": 1352,
          "month": 3,
          "day": 18
        },
        "H": 78,
        "M": 100,
        "S": 120,
        "cash": 610,
        "AP": 2,
        "pollution": 0,
        "injuries": [
          {
            "id": "witch-rebuild-natural:combat:2:PLAYER:584:0",
            "severity": "HEAVY",
            "acquiredRevision": 584,
            "treatedRevision": null
          }
        ],
        "injuryRisk": 0,
        "random": {
          "seed": "assassin-natural-v045",
          "cursor": 207
        },
        "mastery": {
          "assassin.s9.lightness": 32,
          "assassin.s9.vision": 0,
          "assassin.s9.shadow": 32,
          "assassin.s9.burst": 16,
          "assassin.s8.instigation": 50,
          "assassin.s7.black-flame": 0,
          "assassin.s7.frost": 0,
          "assassin.s7.invisibility": 33,
          "assassin.s7.substitute": 33,
          "assassin.s7.divination-interference": 16,
          "assassin.s7.black-magic": 8,
          "assassin.s6.silk-binding": 0,
          "assassin.s6.charm": 0,
          "assassin.s5.disease": 0,
          "assassin.s4.plague": 0,
          "assassin.s3.mirror-passage": 8,
          "assassin.s2.mirror-screen": 8,
          "assassin.s2.black-flame-channel": 8
        },
        "sequence": 2,
        "acting": 100
      },
      "after": {
        "status": "ACTIVE",
        "revision": 588,
        "week": 143,
        "date": {
          "epoch": "FIFTH_EPOCH",
          "year": 1352,
          "month": 3,
          "day": 18
        },
        "H": 78,
        "M": 100,
        "S": 120,
        "cash": 550,
        "AP": 2,
        "pollution": 0,
        "injuries": [
          {
            "id": "witch-rebuild-natural:combat:2:PLAYER:584:0",
            "severity": "HEAVY",
            "acquiredRevision": 584,
            "treatedRevision": 588
          }
        ],
        "injuryRisk": 0,
        "random": {
          "seed": "assassin-natural-v045",
          "cursor": 207
        },
        "mastery": {
          "assassin.s9.lightness": 32,
          "assassin.s9.vision": 0,
          "assassin.s9.shadow": 32,
          "assassin.s9.burst": 16,
          "assassin.s8.instigation": 50,
          "assassin.s7.black-flame": 0,
          "assassin.s7.frost": 0,
          "assassin.s7.invisibility": 33,
          "assassin.s7.substitute": 33,
          "assassin.s7.divination-interference": 16,
          "assassin.s7.black-magic": 8,
          "assassin.s6.silk-binding": 0,
          "assassin.s6.charm": 0,
          "assassin.s5.disease": 0,
          "assassin.s4.plague": 0,
          "assassin.s3.mirror-passage": 8,
          "assassin.s2.mirror-screen": 8,
          "assassin.s2.black-flame-channel": 8
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
        "bottleId": "apocalypse-demoness-potion-1",
        "confirmed": true
      },
      154,
      62,
      42,
      "FAILURE",
      207,
      208
    ],
    [
      {
        "type": "CONSUME",
        "bottleId": "apocalypse-demoness-potion-2",
        "confirmed": true
      },
      163,
      77,
      42,
      "FAILURE",
      208,
      209
    ],
    [
      {
        "type": "CONSUME",
        "bottleId": "apocalypse-demoness-potion-3",
        "confirmed": true
      },
      173,
      96,
      42,
      "GREAT_FAILURE",
      209,
      210
    ],
    [
      {
        "type": "CONSUME",
        "bottleId": "apocalypse-demoness-potion-4",
        "confirmed": true
      },
      183,
      74,
      42,
      "FAILURE",
      210,
      211
    ],
    [
      {
        "type": "CONSUME",
        "bottleId": "apocalypse-demoness-potion-5",
        "confirmed": true
      },
      193,
      55,
      42,
      "FAILURE",
      211,
      212
    ],
    [
      {
        "type": "CONSUME",
        "bottleId": "apocalypse-demoness-potion-6",
        "confirmed": true
      },
      202,
      36,
      42,
      "SUCCESS",
      212,
      213
    ]
  ],
  "lifeChecks": [
    [
      "PULSE_CONTAINMENT",
      23,
      17,
      60,
      "SUCCESS",
      213,
      214
    ],
    [
      "MIRROR_BUFFER",
      27,
      50,
      68,
      "SUCCESS",
      214,
      215
    ]
  ],
  "lifeAbilityUse": {
    "assassin.s1.pulse-containment": {
      "attempts": 1,
      "checkSuccesses": 1,
      "actualApplications": 1,
      "states": [
        "APPLIED",
        "NONE",
        "NONE"
      ]
    },
    "assassin.s1.mirror-buffer": {
      "attempts": 1,
      "checkSuccesses": 1,
      "actualApplications": 1,
      "states": [
        "NONE",
        "APPLIED",
        "NONE"
      ]
    }
  },
  "lifeSha256": "19d04826c7eb01cb90846259a01f3689b96a5275ff54a54d7da1de71b117f6d5",
  "lifeResults": {
    "pulse-containment": [
      {
        "result": "ABILITY",
        "closed": true,
        "exited": true,
        "stopped": false,
        "containment": {
          "attempts": 1,
          "successes": 1,
          "effects": 1,
          "tier": "SUCCESS",
          "state": "APPLIED"
        },
        "buffer": {
          "attempts": 0,
          "successes": 0,
          "effects": 0,
          "tier": null,
          "state": "NONE"
        },
        "plate": {
          "id": "AD1-PLATE-1",
          "caseId": "pulse-containment",
          "ownerId": "PLAYER",
          "quantity": 1,
          "paidPennies": 20,
          "boughtWeek": 204,
          "status": "RETURNED",
          "location": "CUSTODIAN",
          "charges": 0,
          "wear": 5,
          "scorched": true,
          "installedAt": 494,
          "removedAt": 498,
          "returnedAt": 513
        },
        "impactDamage": 0,
        "impactReduction": 0
      }
    ],
    "mirror-buffer": [
      {
        "result": "ABILITY",
        "closed": true,
        "exited": true,
        "stopped": false,
        "containment": {
          "attempts": 0,
          "successes": 0,
          "effects": 0,
          "tier": null,
          "state": "NONE"
        },
        "buffer": {
          "attempts": 1,
          "successes": 1,
          "effects": 1,
          "tier": "SUCCESS",
          "state": "APPLIED"
        },
        "plate": {
          "id": "AD1-PLATE-2",
          "caseId": "mirror-buffer",
          "ownerId": "PLAYER",
          "quantity": 1,
          "paidPennies": 20,
          "boughtWeek": 206,
          "status": "RETURNED",
          "location": "CUSTODIAN",
          "charges": 0,
          "wear": 5,
          "scorched": false,
          "installedAt": 600,
          "removedAt": 603,
          "returnedAt": 614
        },
        "impactDamage": 3,
        "impactReduction": 3
      }
    ],
    "withdrawn-window": [
      {
        "result": "ORDINARY",
        "closed": true,
        "exited": true,
        "stopped": true,
        "containment": {
          "attempts": 0,
          "successes": 0,
          "effects": 0,
          "tier": null,
          "state": "NONE"
        },
        "buffer": {
          "attempts": 0,
          "successes": 0,
          "effects": 0,
          "tier": null,
          "state": "NONE"
        },
        "plate": {
          "id": "AD1-PLATE-3",
          "caseId": "withdrawn-window",
          "ownerId": "PLAYER",
          "quantity": 1,
          "paidPennies": 20,
          "boughtWeek": 208,
          "status": "RETURNED",
          "location": "CUSTODIAN",
          "charges": 1,
          "wear": 0,
          "scorched": false,
          "installedAt": 700,
          "removedAt": 706,
          "returnedAt": 721
        },
        "impactDamage": 0,
        "impactReduction": 0
      }
    ]
  },
  "residue": {
    "id": "AD1-RESIDUE-1",
    "ownerId": "UD3-MARCUS",
    "quantity": 1,
    "fictional": true,
    "biological": false,
    "origin": "ADULT_WORKSHOP_CUSTODIAN",
    "paidPennies": 50,
    "boughtWeek": 204,
    "location": "BOX",
    "sealed": true,
    "receivedAt": 493,
    "remaining": 0,
    "consumed": 1,
    "pendingAt": null,
    "appliedAt": 497,
    "suppressed": 1,
    "ordinarySealed": false
  },
  "load": {
    "id": "AD1-IMPACT-1",
    "ownerId": "UD3-VERA",
    "paidPennies": 30,
    "boughtWeek": 206,
    "location": "A",
    "arrivedAt": 598,
    "preparedAt": 599,
    "remaining": 0,
    "consumed": 1,
    "appliedAt": 602,
    "safetyStop": "ENGAGED"
  },
  "combatRounds": 4,
  "roundHashes": [
    "d69196bd6d3fdd103ddac711747348f2b6cca10d84c6a0a1c8dd6be6fd4b5a86",
    "16c05699ceef38dd7cb747de9359950dcaa53afe9d50fd97875ab0aa198c0354",
    "ae18b981bc93fc94845d38bdcbd20780df27b74263679340e0ea810c274adc62",
    "49328a7377e80e17b2190d392583012ebdf1cddfaeac7a309e8a9803c9ad12ec"
  ],
  "encounterSha256": "11f46ff8c732c2465ffd5d99178026d98e93108400ed86aff3519904ee553cc7",
  "terminal": {
    "outcome": "ENEMY_SURRENDERED",
    "round": 4,
    "historyIndex": 16,
    "enemyHealth": 70,
    "enemyMind": 100,
    "enemySpirituality": 96,
    "enemyStatus": "SURRENDERED",
    "exitMetres": 4,
    "exitSeconds": 4
  },
  "actualCosts": {
    "acquisitionCash": 8100,
    "acquisitionAP": 41,
    "lifeCash": 185,
    "lifeAP": 10,
    "lifeSpirituality": 16,
    "lifeMind": 4,
    "playerOrdinaryMetres": 52,
    "veraOrdinaryMetres": 12,
    "marcusOrdinaryMetres": 12,
    "playerEnergySpent": 55,
    "playerEnergyRecovered": 60
  },
  "combatAbilityUse": {
    "assassin.s1.pulse-containment": {
      "plannedSelections": 3,
      "paidAttempts": 1,
      "successfulChecks": 1,
      "actualApplications": 0
    },
    "assassin.s1.mirror-buffer": {
      "plannedSelections": 1,
      "paidAttempts": 1,
      "successfulChecks": 1,
      "actualApplications": 1
    }
  }
};
const hash = (value: unknown) => createHash('sha256').update(stableStringify(value)).digest('hex');
const rawHash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const same = (actual: unknown, wanted: unknown) => expect(hash(actual)).toBe(hash(wanted));
const entry = <T>(key: string): T => readObjectEntry<T>(`${ROOT}/natural.json`, key);
const source = <T>(key: string): T => readObjectEntry<T>(SOURCE, key);
const summary = <T>(key: string): T => readObjectEntry<T>(`${ROOT}/summary.json`, key);
const commands = entry<SliceIntent[]>('commands');
const boundaries = JSON.parse(readFileSync(`${ROOT}/boundaries.index.json`, 'utf8')) as Record<string, string>;
const steps = JSON.parse(readFileSync(`${ROOT}/boundaries.steps.json`, 'utf8')) as Record<string, number>;
const snapshots = entry<Record<string, string>>('snapshots');
const current = (value: unknown): SliceState => {
  const s = migrateSliceState(value);
  expect([s.schemaVersion, s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]); return s;
};
const state = (key: 'initial' | 'prefixFinal' | 'beforeLast' | 'final') => current(entry(key));
const localPath = (filename: string): string => {
  if (filename !== basename(filename) || !filename.endsWith('.json')) throw new Error(`Nonlocal capture reference: ${filename}`);
  return `${ROOT}/${filename}`;
};
const snapshot = (name: string) => current(JSON.parse(readFileSync(localPath(snapshots[name]!), 'utf8')));
const site = (s: SliceState) => s.apocalypseDemoness.life.site ?? s.calamityDemoness.encounter.currentSite ?? s.calamityDemoness.life.site;
const body = (s: SliceState) => ({ status: s.status, revision: s.revision, week: s.week, date: s.date, H: s.health, M: s.mind, S: s.spirituality,
  cash: s.cash, AP: s.actionsRemaining, pollution: s.seer.pollution, injuries: s.injuries, injuryRisk: s.injuryRisk,
  random: s.random, mastery: s.progression.mastery, sequence: s.progression.sequence, acting: s.progression.acting });
const sum = <T>(rows: readonly T[], value: (row: T) => number) => rows.reduce((n, row) => n + value(row), 0);
async function fileHash(path: string): Promise<string> {
  const digest = createHash('sha256'); for await (const chunk of createReadStream(path)) digest.update(chunk); return digest.digest('hex');
}
async function* jsonLines<T>(name: 'commands.jsonl' | 'public.jsonl'): AsyncGenerator<T> {
  const stream = createReadStream(`${ROOT}/${name}`, { encoding: 'utf8' }), lines = createInterface({ input: stream, crlfDelay: Infinity });
  try { for await (const line of lines) { expect(line.length).toBeGreaterThan(0); yield JSON.parse(line) as T; } }
  finally { lines.close(); stream.destroy(); }
}
function boundary(name: string) {
  const filename = boundaries[name]; if (!filename) throw new Error(`Missing observed boundary: ${name}`);
  const path = localPath(filename);
  return { count: readObjectEntry<number>(path, 'commandCount'), before: current(readObjectEntry(path, 'beforeLast')),
    intent: readObjectEntry<SliceIntent>(path, 'lastIntent'), final: current(readObjectEntry(path, 'final')) };
}
/** Adapt only newly emitted guidance in the current replay expectation. The
 * archived checkpoint, original prose and all gameplay/RNG fields stay exact. */
function withCurrentGuidance(archived: SliceState): SliceState {
  const expected = structuredClone(archived), records = expected.chronicle.filter(record => record.id === 'record-594-936');
  expect(records).toHaveLength(1);
  const record = records[0]!;
  expect({ id: record.id, week: record.week, title: record.title }).toEqual({
    id: 'record-594-936', week: 145, title: '听取末日魔女独立成品与专业准备指导',
  });
  expect(createHash('sha256').update(record.text).digest('hex')).toBe('cae8b6d40ef3fa393d5778c9aa475a45b583e382b6530af5bd26b362c373a268');
  const oldGuidance = '三瓶全部失败耗尽后，可花1行动与100便士申请下一批，至少跨一真实周再接收三瓶；各瓶费用与准备单独结算。';
  const currentGuidance = '最初三份原特性总量保持三。三瓶真实失败后，可花1行动与120便士调查指定原失败回执，隔一真实周再花1行动回原展廊出口，当面重新取得马库斯本次许可并封存同一份原特性。重配容器不是第四份原特性，旧瓶及失败结果保留；本次新普通药物与调配服务900便士，或五项新劳动后90便士。另付150便士与1行动检查当周场地。可选择为指定未服瓶另付60便士、8灵性、6精神，获得只限本瓶、本场、本周的意志+13支持；按当前意志动态显示概率，仍会失败。退出、跨周或服药即失效，无退款、无补伤、无净化；污染须走正常净化、收入与休养流程。成功后仍从末日魔女生活实践0/100开始。';
  expect(record.text.endsWith(oldGuidance)).toBe(true);
  expect(expected.chronicle.reduce((count, row) => count + row.text.split(oldGuidance).length - 1, 0)).toBe(1);
  const latestGuidance = expected.lastResult?.id === record.id ? expected.lastResult : null;
  if (latestGuidance) same(latestGuidance, record);
  record.text = record.text.slice(0, -oldGuidance.length) + currentGuidance;
  if (latestGuidance) latestGuidance.text = record.text;
  return expected;
}
function publicControl(s: SliceState, intent: SliceIntent): void {
  expect(validateSlicePayload(intent), JSON.stringify(intent)).toBe(true);
  const view = projectSliceState(s);
  if (intent.type === 'APOCALYPSE_DEMONESS') {
    const offered = view.apocalypseDemoness.actions.find(a => stableStringify(a.command) === stableStringify(intent.command));
    expect(offered).toBeDefined(); expect(offered!.enabled, offered!.reason ?? JSON.stringify(intent)).toBe(true);
  } else if (intent.type === 'ACTION') {
    expect(['WORK', 'REST']).toContain(intent.action); expect(view.canAct, view.actionBlockedReason ?? '').toBe(true);
    expect(view.apocalypseDemoness.insideCase).toBe(false); expect(s.combat).toBeNull(); expect(s.apocalypseDemoness.preparedWeek).toBeNull();
  } else if (intent.type === 'EVENT_CHOICE') {
    expect(s.activeEvent?.instanceId).toBe(intent.eventInstanceId);
    expect(view.activeEvent?.choices.find(c => c.id === intent.choiceId)?.enabled).toBe(true);
  } else if (intent.type === 'COMBAT_ROUND') {
    expect(view.status).toBe('ACTIVE'); expect(view.activeEvent).toBeNull(); expect(intent.stance).toBe('CONTROL');
    expect(view.combat?.stances.some(c => c.id === intent.stance)).toBe(true);
  } else throw new Error(`Unexpected new public command: ${JSON.stringify(intent)}`);
}
function originals(s: SliceState, original: SliceState): void {
  for (const key of APOCALYPSE_DEMONESS_SOURCE_KEYS) same(s[key], original[key]);
  const oldSite = original.calamityDemoness.encounter.currentSite!;
  if (s.apocalypseDemoness.guidanceKnown) {
    same(s.apocalypseDemoness.sourceHistory, Object.fromEntries(APOCALYPSE_DEMONESS_SOURCE_KEYS.map(key => [key, original[key]])));
    same(s.apocalypseDemoness.sourceScene!.originals, { site: oldSite, combatPlate: original.calamityDemoness.encounter.plate });
    expect(validateApocalypseDemonessSource(s)).toBe(true);
  }
  if (s.apocalypseDemoness.promotionWeek === null) { expect(s.apocalypseDemoness.life.site).toBeNull(); same(site(s), oldSite); }
  else same(apocalypseDemonessExpectedOriginals(s), { site: site(s), combatPlate: s.calamityDemoness.encounter.plate });
  for (const key of ['load', 'plates', 'residue', 'mirrorA', 'mirrorB', 'source'] as const) same(site(s)[key], oldSite[key]);
  expect(site(s).box.scorched).toBe(true); expect(site(s).box.pulses).toBeGreaterThanOrEqual(oldSite.box.pulses);
  expect(site(s).playerTravelMetres).toBeGreaterThanOrEqual(oldSite.playerTravelMetres);
  same(s.combatHistory.slice(0, original.combatHistory.length), original.combatHistory);
  const mastery = { ...original.progression.mastery };
  if (s.progression.sequence === 1) {
    for (const id of APOCALYPSE_DEMONESS_ABILITY_IDS) mastery[id] = 0;
    for (const [id, gain] of Object.entries(apocalypseDemonessLifeMasteryGains(s))) mastery[id] = Math.min(500, mastery[id]! + gain);
  }
  for (const round of s.combatHistory.slice(original.combatHistory.length)) {
    expect(round.apocalypseDemonessOutcome).toBeDefined();
    for (const action of [...round.apocalypseDemonessOutcome!.playerActions, ...round.apocalypseDemonessOutcome!.enemyActions]) {
      for (const id of action.masteryApplied) { expect(Object.hasOwn(mastery, id)).toBe(true); mastery[id] = Math.min(500, mastery[id]! + 8); }
    }
  }
  same(s.progression.mastery, mastery);
  const { coreStats, ...identity } = s.character, { coreStats: oldStats, ...oldIdentity } = original.character;
  same(identity, oldIdentity);
  for (const id of Object.keys(oldStats) as (keyof typeof oldStats)[]) expect(coreStats[id]).toBe(Math.min(500, oldStats[id] + (s.progression.sequence === 1 ? 1 : 0)));
  expect(s.runId).toBe(original.runId); expect(s.random.seed).toBe(SEED); expect(s.progression.promotionWeek).toBe(original.progression.promotionWeek);
}

describe('Apocalypse Demoness exact585 natural source and observed public continuation', () => {
  it('pins immutable raw174 source, natural487 ancestry, frozen producer and current migrated format separately', async () => {
    expect(await fileHash(SOURCE)).toBe(SOURCE_SHA); expect(await fileHash(PRIOR)).toBe(PRIOR_SHA);
    expect(await fileHash('scripts/play/apocalypse-demoness-stage.mjs')).toBe(expected.producerSha256);
    expect(await fileHash(localPath(boundaries['step-688-action']!))).toBe('34e43b3cb872a7c43851e5d3d583983e06b2081d8645bc42cd10b6d243a5bb67');
    const raw = source<SliceState>('final');
    expect(raw).toMatchObject({ schemaVersion: 174, contentVersion: 'calamity-demoness-v174', status: 'ACTIVE', revision: 586,
      week: 143, health: 70, mind: 100, spirituality: 120, cash: 610, actionsRemaining: 3, random: { seed: SEED, cursor: 207 } });
    expect(raw.injuries).toEqual([{ id: 'witch-rebuild-natural:combat:2:PLAYER:584:0', severity: 'HEAVY', acquiredRevision: 584, treatedRevision: null }]);
    expect(rawHash(raw)).toBe('cf00e4a0e2c896a3ad6ae563788bad3e5212255013c12a1483afc23386751c77');
    expect(rawHash(source('initial'))).toBe('36dc75f5cc2e07ab5e93b068b460865bec8822a9a4ff9db7f53b7c3339420241');
    expect(rawHash(source('commands'))).toBe(PREFIX_SHA); expect(source('prefixCount')).toBe(INHERITED_COUNT);
    const prior = readObjectEntry<SliceIntent[]>(PRIOR, 'commands'); expect(prior).toHaveLength(INHERITED_COUNT);
    expect(rawHash(prior)).toBe('ae3b88cd87320a6ce1d311189870414c7ebb3467ddb80a76ac7536b29cd454da');
    same(commands.slice(0, INHERITED_COUNT), prior); same(commands.slice(0, PREFIX_COUNT), source('commands'));
    same(state('prefixFinal'), migrateSliceState(raw)); same(state('initial'), migrateSliceState(source('initial')));
    for (const key of ['initial', 'prefixFinal', 'beforeLast', 'final']) expect(entry(key)).toMatchObject({ schemaVersion: 196, contentVersion: 'apocalypse-demoness-v196' });
    expect(rawHash(entry('final'))).toBe(expected.rawFinalSha256); expect(rawHash(entry('prefixFinal'))).toBe(expected.rawPrefixFinalSha256);
    expect(entry('producerSha256')).toBe(expected.producerSha256);
    expect(entry('provenance')).toMatchObject({ kind: 'EXACT585_PUBLIC_CALAMITY_THEN_PUBLIC_APOCALYPSE_DEMONESS', source: SOURCE,
      sourceSha256: SOURCE_SHA, sourceRoot: 'final', inheritedDirectedPrefix: false, fullNaturalS9ToS1: expected.fullNaturalS9ToS1, newRandomChanges: false });
    expect(entry('inheritedPrefixCount')).toBe(INHERITED_COUNT); expect(entry('prefixVerified')).toBe(true);
  }, 60_000);

  it('uses actual currentSite OUTSIDE22 rather than historical ENTRY28, preserving all18 skills including seven zeros', () => {
    const original = state('prefixFinal'), old = original.calamityDemoness;
    expect(old.life.site).toMatchObject({ playerLocation: 'ENTRY', playerEnergy: 28 });
    expect(old.encounter.currentSite).toMatchObject({ playerLocation: 'OUTSIDE', playerEnergy: 22, playerTravelMetres: 78, clockSeconds: 407,
      vera: { age: 46, location: 'OUTSIDE', energy: 92, travelMetres: 8 }, marcus: { age: 41, location: 'OUTSIDE', energy: 70, travelMetres: 30 },
      load: { remainingLoads: 0, appliedLoads: 1 }, residue: { status: 'CONSUMED' }, box: { state: 'CLOSED', scorched: true, pulses: 1 } });
    expect(old.encounter.currentSite!.plates.map(p => [p.status, p.charges])).toEqual([['RETURNED', 0], ['RETURNED', 0], ['RETURNED', 1]]);
    expect(old.encounter).toMatchObject({ status: 'RETREATED', targetId: 'CD2-IRIS', enemyHealth: 100, enemyMind: 100, enemySpirituality: 97, enemyStatus: 'RESISTING', plate: { charges: 3 } });
    expect(Object.keys(original.progression.mastery)).toHaveLength(18); expect(Object.values(original.progression.mastery).filter(n => n === 0)).toHaveLength(7);
    same(original.progression.mastery, expected.originalMastery); originals(state('final'), original);
    same(summary('sourceOriginals'), { site: old.encounter.currentSite }); same(summary('currentOriginals'), { site: site(state('final')) });
  });

  it('replays the exact688 current commands and strictly validates the unchanged854-command archive without new legacy supply', () => {
    expect(commands).toHaveLength(expected.commands); expect(entry('prefixCount')).toBe(PREFIX_COUNT);
    same(entry('strategy'), expected.strategy); let s = current(source('initial')); const original = state('prefixFinal');
    const stop = boundary('step-688-action'), archivedHash = hash(stop.final);
    expect(stop.count).toBe(688); same(stop.intent, commands[687]);
    expect(commands[688]).toEqual({ type: 'APOCALYPSE_DEMONESS', command: { type: 'REQUEST_SUPPLY' } });
    expect(commands[690]).toEqual({ type: 'APOCALYPSE_DEMONESS', command: { type: 'RECEIVE_SUPPLY' } });
    same(s, state('initial'));
    for (const [index, intent] of commands.slice(0, stop.count).entries()) {
      if (intent.type === 'CONTINUE_LIFE') { expect(index).toBeLessThan(PREFIX_COUNT); expect(s.status).toBe('SLICE_COMPLETE'); expect(s.ending?.kind).not.toBe('DEATH'); }
      else expect(s.status, `No command after death at step${index + 1}`).toBe('ACTIVE');
      if (index >= PREFIX_COUNT) publicControl(s, intent);
      const before = s; s = applySliceIntent(s, intent);
      expect(s.revision).toBe(before.revision + 1); expect(s.random.seed).toBe(SEED); expect(s.random.cursor).toBeGreaterThanOrEqual(before.random.cursor);
      if (index === INHERITED_COUNT - 1) same(s, current(readObjectEntry(PRIOR, 'final')));
      if (index === PREFIX_COUNT - 1) same(s, original);
      if (index >= PREFIX_COUNT) originals(s, original);
    }
    same(s, withCurrentGuidance(stop.final)); assertValidSliceState(s); same(migrateSliceState(s), s);
    expect(s.apocalypseDemoness.bottles.map(bottle => bottle.outcome)).toEqual(['FAILURE', 'FAILURE', 'GREAT_FAILURE']);
    expect(s.random).toEqual({ seed: SEED, cursor: 210 });
    expect(s.revision).toBe(state('initial').revision + stop.count);
    expect(projectSliceState(s).apocalypseDemoness.actions.some(action =>
      action.command.type === 'REQUEST_SUPPLY' || action.command.type === 'RECEIVE_SUPPLY')).toBe(false);
    publicControl(s, { type: 'APOCALYPSE_DEMONESS', command: { type: 'REQUEST_RECOVERY_V1', bottleId: 'apocalypse-demoness-potion-1' } });
    const stoppedHash = hash(s);
    for (const intent of [commands[688]!, commands[690]!]) {
      expect(validateSlicePayload(intent)).toBe(false); expect(() => applySliceIntent(s, intent)).toThrow(); expect(hash(s)).toBe(stoppedHash);
    }
    expect(hash(stop.final)).toBe(archivedHash);
    // Strict historical validators retain every original receipt, including the
    // three independent fourth-plus bottles. No live reducer bypass is used.
    const final = state('final'); assertValidSliceState(final); same(migrateSliceState(final), final);
    expect(validateApocalypseDemonessAcquisitionJournal(final)).toBe(true);
    expect(validateApocalypseDemonessJournalContinuity(final)).toBe(true);
    expect(validateApocalypseDemonessLifeState(final)).toBe(true); expect(validateApocalypseDemonessEncounterState(final)).toBe(true);
    expect(final.apocalypseDemoness.bottles).toHaveLength(6);
    expect(final.apocalypseDemoness.bottles.slice(3).every(bottle => bottle.recovery === undefined)).toBe(true);
    expect(projectSliceState(final).apocalypseDemoness.actions).toEqual([]);
    originals(final, original); same(body(final), expected.final);
    expect(entry('stage')).toBe(expected.stage); expect(entry('error')).toBeNull(); expect(entry('pendingIntent')).toBeNull(); expect(entry('failurePhase')).toBe('IDLE');
    expect(final.revision).toBe(state('initial').revision + expected.commands);
  }, 240_000);

  it('retains contiguous whole command and public ledgers and exact observed snapshot names', async () => {
    expect(Object.keys(boundaries)).toHaveLength(expected.namedBoundaries); same(Object.keys(steps), Object.keys(boundaries));
    same(Object.keys(snapshots), expected.snapshots);
    type Ledger = { step: number; sourcePrefix: boolean; intent: SliceIntent; before: ReturnType<typeof body>; after: ReturnType<typeof body> };
    let count = 0, previous = body(state('initial'));
    const newRows = new Map<number, Ledger>();
    for await (const row of jsonLines<Ledger>('commands.jsonl')) {
      expect(row.step).toBe(++count); expect(row.sourcePrefix).toBe(count <= PREFIX_COUNT); same(row.intent, commands[count - 1]);
      same(row.before, previous); expect(row.after.revision).toBe(row.before.revision + 1); previous = row.after;
      if (row.intent.type === 'CONTINUE_LIFE') { expect(count).toBeLessThanOrEqual(PREFIX_COUNT); expect(row.before.status).toBe('SLICE_COMPLETE'); }
      else expect(row.before.status, `No captured command after death at step${count}`).toBe('ACTIVE');
      expect(row.after.random.seed).toBe(SEED); expect(row.after.random.cursor).toBeGreaterThanOrEqual(row.before.random.cursor);
      if (count > PREFIX_COUNT) newRows.set(count, row);
    }
    expect(count).toBe(expected.commands); same(previous, expected.final); count = PREFIX_COUNT;
    type Public = { step: number; revision: number; command: SliceIntent; control: { enabled?: boolean; kind?: string; stance?: string };
      randomBefore: SliceState['random']; randomAfter: SliceState['random']; before: ReturnType<typeof body>; after: ReturnType<typeof body> };
    for await (const row of jsonLines<Public>('public.jsonl')) {
      expect(row.step).toBe(++count); same(row.command, commands[count - 1]); const ledger = newRows.get(count)!;
      expect(row.revision).toBe(ledger.before.revision); same(row.randomBefore, ledger.before.random); same(row.randomAfter, ledger.after.random);
      for (const key of Object.keys(ledger.before) as (keyof ReturnType<typeof body>)[]) { same(row.before[key], ledger.before[key]); same(row.after[key], ledger.after[key]); }
      if (row.command.type === 'COMBAT_ROUND') expect(row.control).toMatchObject({ kind: 'COMBAT_ROUND', stance: 'CONTROL' });
      else expect(row.control.enabled).toBe(true);
    }
    expect(count).toBe(expected.commands);
  }, 60_000);

  it('charges actual clinic recovery,500 guidance, bottle labour and each current-week preparation without a refill or free mastery', () => {
    const final = state('final'), original = state('prefixFinal'), journal = final.apocalypseDemoness.acquisitionJournal;
    same(entry('treatments'), expected.treatments); expect(entry<unknown[]>('treatments')).toHaveLength(expected.treatments.length);
    const recovered = snapshot('sourceRecovered'); expect(recovered).toMatchObject({ health: 100, injuries: [], injuryRisk: 0 });
    const guidance = boundary('paid500-guidance-freezes-eight-roots'); expect(guidance.before.cash - guidance.final.cash).toBe(500);
    same(guidance.final.apocalypseDemoness.sourceScene!.originals, { site: original.calamityDemoness.encounter.currentSite, combatPlate: original.calamityDemoness.encounter.plate });
    same(final.apocalypseDemoness.bottles, expected.bottles);
    expect(final.apocalypseDemoness.bottles.map(b => b.outcome)).toEqual(['FAILURE', 'FAILURE', 'GREAT_FAILURE', 'FAILURE', 'FAILURE', 'SUCCESS']);
    const request = boundary('paid-next-week-resupply'), receive = boundary('actual-next-week-new-stock');
    expect(request.before.cash - request.final.cash).toBe(100); expect(request.before.actionsRemaining - request.final.actionsRemaining).toBe(1);
    expect(request.final.apocalypseDemoness.resupply.requestedWeek).toBe(174); expect(receive.before.week).toBe(175);
    expect(receive.before.apocalypseDemoness.bottles).toHaveLength(3); expect(receive.final.apocalypseDemoness.bottles).toHaveLength(6);
    same(receive.before.apocalypseDemoness.bottles, receive.final.apocalypseDemoness.bottles.slice(0, 3));
    expect(receive.final.apocalypseDemoness.bottles.slice(3).map(b => [b.status, b.stockedWeek, b.labourSteps])).toEqual([['SUPPLIER', 175, 0], ['SUPPLIER', 175, 0], ['SUPPLIER', 175, 0]]);
    expect(final.apocalypseDemoness.preparations.map(r => r.taskId)).toEqual(['VERIFY_ORIGINALS', 'PLAN_CONTAINMENT', 'CHECK_RETURN']);
    same(journal.filter(r => r.check).map(r => [r.command, r.week, r.check!.roll, r.check!.chance, r.check!.tier, r.randomBefore, r.randomAfter]), expected.acquisitionChecks);
    for (const bottle of final.apocalypseDemoness.bottles.filter(b => b.status === 'CONSUMED')) {
      const buy = boundary(`actual1100p-buy-${bottle.id}`), prep = boundary(`actual150p-current-week-prepare-${bottle.id}`), dose = boundary(`consume-${bottle.id}`);
      expect(buy.final.apocalypseDemoness.acquisitionJournal.at(-1)!.before.cash - buy.final.apocalypseDemoness.acquisitionJournal.at(-1)!.after.cash).toBe(1100);
      expect(prep.final.apocalypseDemoness.acquisitionJournal.at(-1)!.before.cash - prep.final.apocalypseDemoness.acquisitionJournal.at(-1)!.after.cash).toBe(150);
      expect(journal.filter(r => r.command.type === 'POTION_WORK' && r.command.bottleId === bottle.id)).toHaveLength(5);
      expect(dose.before.week - original.calamityDemoness.promotionWeek!).toBeGreaterThanOrEqual(12);
      expect(dose.before.apocalypseDemoness.preparedWeek).toBe(dose.before.week); expect(dose.final.apocalypseDemoness.preparedWeek).toBeNull();
      expect(dose.final.random.cursor).toBe(dose.before.random.cursor + 1); same(site(dose.final), site(dose.before)); same(dose.final.injuries, dose.before.injuries);
      expect(dose.final.spirituality).toBe(dose.before.spirituality);
      const costs = { GREAT_SUCCESS: [0, 8, 0], SUCCESS: [0, 15, 0], FAILURE: [15, 25, 30], GREAT_FAILURE: [25, 45, 60] }[bottle.outcome!];
      expect(dose.final.health).toBe(Math.max(1, dose.before.health - costs[0]!)); expect(dose.final.mind).toBe(Math.max(1, dose.before.mind - costs[1]!));
      expect(dose.final.seer.pollution).toBe(Math.min(100, dose.before.seer.pollution + costs[2]!));
      if (dose.final.progression.sequence === 1) {
        for (const [id, value] of Object.entries(original.progression.mastery)) expect(dose.final.progression.mastery[id], id).toBe(value);
        expect(APOCALYPSE_DEMONESS_ABILITY_IDS.map(id => dose.final.progression.mastery[id])).toEqual([0, 0]);
      }
    }
    expect(validateApocalypseDemonessAcquisitionJournal(final)).toBe(true); expect(validateApocalypseDemonessJournalContinuity(final)).toBe(true);
  }, 60_000);

  it('accounts for actual life applications, separate paid resources, withdrawal and the exact body/object movement ledger', () => {
    const final = state('final'), original = state('prefixFinal'), life = final.apocalypseDemoness.life;
    same(summary('lifeAbilityUse'), expected.lifeAbilityUse); same(summary('lifeCases'), life.cases);
    same(life.journal.filter(r => r.check).map(r => [r.command.type, r.checkBase, r.check!.roll, r.check!.chance, r.check!.tier, r.randomBefore, r.randomAfter]), expected.lifeChecks);
    expect(hash(life)).toBe(expected.lifeSha256);
    for (const id of APOCALYPSE_DEMONESS_CASE_IDS) {
      const c = life.cases[id]; same(c.attempts.map(a => ({ result: a.result, closed: a.closed, exited: a.exited, stopped: a.stopped,
        containment: a.containment, buffer: a.buffer, plate: a.plate, impactDamage: a.impactDamage, impactReduction: a.impactReduction })), expected.lifeResults[id]);
      for (const a of c.attempts) {
        expect(a.plate).toMatchObject({ paidPennies: 20, status: 'RETURNED', location: 'CUSTODIAN' });
        expect(a.playerTravelMetres).toBeGreaterThan(0); expect(a.playerEnergySpent).toBeGreaterThan(0);
        expect(a.containment.effects).toBeLessThanOrEqual(a.containment.successes); expect(a.buffer.effects).toBeLessThanOrEqual(a.buffer.successes);
      }
    }
    for (const r of life.journal) {
      if (r.command.type === 'PULSE_CONTAINMENT' || r.command.type === 'MIRROR_BUFFER') {
        expect(r.before.spirituality - r.after.spirituality).toBe(8); expect(r.before.mind - r.after.mind).toBe(2);
        expect(r.elapsedSeconds).toBe(1); expect(r.check).not.toBeNull();
      }
      if (r.command.type === 'RECOVER_ENERGY') { expect(r.before.cash - r.after.cash).toBe(15); expect(r.before.actions - r.after.actions).toBe(1); expect(r.playerEnergyRecovered).toBe(20); expect(r.elapsedSeconds).toBe(60); }
    }
    same(life.residue, expected.residue); same(life.load, expected.load);
    for (const [name, id] of [['pulse-containment-pulse_containment', APOCALYPSE_DEMONESS_ABILITY_IDS[0]], ['mirror-buffer-mirror_buffer', APOCALYPSE_DEMONESS_ABILITY_IDS[1]]] as const) {
      const cast = boundary(name); same(cast.final.progression.mastery, cast.before.progression.mastery);
      expect(cast.final.apocalypseDemoness.life.pending).not.toBeNull();
      const pending = cast.final.apocalypseDemoness.life.pending!;
      expect(pending.expiresAt - pending.createdAt).toBeLessThanOrEqual(20); expect(cast.final.progression.mastery[id]).toBe(0);
    }
    const pulse = boundary('pulse-containment-apply_pulse'), impact = boundary('mirror-buffer-apply_load');
    expect(pulse.before.apocalypseDemoness.life.residue!.remaining).toBe(1); expect(pulse.final.apocalypseDemoness.life.residue).toMatchObject({ remaining: 0, consumed: 1, suppressed: 1 });
    same(pulse.final.progression.mastery, pulse.before.progression.mastery);
    expect(pulse.final.apocalypseDemoness.life.cases['pulse-containment'].attempts[0]!.containment.effects).toBe(1);
    expect(impact.before.health - impact.final.health).toBe(3); expect(impact.final.apocalypseDemoness.life.load).toMatchObject({ remaining: 0, consumed: 1 });
    same(impact.final.progression.mastery, impact.before.progression.mastery);
    expect(impact.final.apocalypseDemoness.life.cases['mirror-buffer'].attempts[0]!.buffer.effects).toBe(1);
    for (const [caseId, ability] of [['pulse-containment', APOCALYPSE_DEMONESS_ABILITY_IDS[0]], ['mirror-buffer', APOCALYPSE_DEMONESS_ABILITY_IDS[1]]] as const) {
      const report = boundary(`${caseId}-honest-report`);
      expect(report.intent).toEqual({ type: 'APOCALYPSE_DEMONESS', command: { type: 'REPORT', caseId } });
      expect(report.before.apocalypseDemoness.life.cases[caseId].status).toBe('EXAMINED');
      expect(report.final.apocalypseDemoness.life.cases[caseId].status).toBe('RESOLVED');
      expect(report.final.progression.mastery[ability]! - report.before.progression.mastery[ability]!).toBe(8);
      const reported = stableStringify(report.final);
      expect(() => applySliceIntent(report.final, report.intent)).toThrow();
      expect(stableStringify(report.final)).toBe(reported);
    }
    for (const [capture, caseId] of [[pulse, 'pulse-containment'], [impact, 'mirror-buffer']] as const) {
      expect(capture.before.apocalypseDemoness.life.cases[caseId].attempts[0]!.plate.charges).toBe(1);
      expect(capture.final.apocalypseDemoness.life.cases[caseId].attempts[0]!.plate).toMatchObject({ charges: 0, wear: 5 });
      expect(capture.final.apocalypseDemoness.life.pending).toBeNull(); same(capture.before.random, capture.final.random);
    }
    const withdrawn = boundary('withdrawn-window-withdraw_consent');
    expect(withdrawn.intent).toEqual({ type: 'APOCALYPSE_DEMONESS', command: { type: 'WITHDRAW_CONSENT', permission: 'PARTICIPANT' } });
    expect(life.cases['withdrawn-window'].attempts[0]).toMatchObject({ stopped: true, exited: true, permission: { participant: 'WITHDRAWN' }, containment: { attempts: 0, effects: 0 }, buffer: { attempts: 0, effects: 0 }, plate: { charges: 1, status: 'RETURNED' } });
    same(withdrawn.before.random, withdrawn.final.random); expect(withdrawn.final.apocalypseDemoness.life.pending).toBeNull();
    const acq = final.apocalypseDemoness.acquisitionJournal, journal = life.journal;
    same({ acquisitionCash: sum(acq, r => r.before.cash - r.after.cash), acquisitionAP: sum(acq, r => r.before.actions - r.after.actions),
      lifeCash: sum(journal, r => r.before.cash - r.after.cash), lifeAP: sum(journal, r => r.before.actions - r.after.actions),
      lifeSpirituality: sum(journal, r => r.before.spirituality - r.after.spirituality), lifeMind: sum(journal, r => r.before.mind - r.after.mind),
      playerOrdinaryMetres: sum(journal, r => r.playerWalkedMetres), veraOrdinaryMetres: sum(journal, r => r.veraWalkedMetres), marcusOrdinaryMetres: sum(journal, r => r.marcusWalkedMetres),
      playerEnergySpent: sum(journal, r => r.playerEnergySpent), playerEnergyRecovered: sum(journal, r => r.playerEnergyRecovered) }, expected.actualCosts);
    const events = [...life.journal.map(r => ({ revision: r.revision, before: r.originalsBefore, after: r.originalsAfter })), ...apocalypseDemonessEncounterOriginalEvents(final)].sort((a, b) => a.revision - b.revision);
    let objects = { site: original.calamityDemoness.encounter.currentSite!, combatPlate: original.calamityDemoness.encounter.plate };
    for (const event of events) { same(event.before, objects); objects = event.after; }
    same(objects, apocalypseDemonessExpectedOriginals(final)); same(objects, { site: site(final), combatPlate: original.calamityDemoness.encounter.plate });
    expect(validateApocalypseDemonessLifeState(final)).toBe(true); expect(validateApocalypseDemonessEncounterState(final)).toBe(true);
  }, 60_000);

  it('reconciles all actual independent Leona rounds, finite sources and application-only combat mastery', () => {
    const final = state('final'), original = state('prefixFinal'), rounds = final.combatHistory.slice(original.combatHistory.length);
    expect(rounds).toHaveLength(expected.combatRounds); same(summary('rounds'), rounds); expect(hash(final.apocalypseDemoness.encounter)).toBe(expected.encounterSha256);
    same(rounds.map(hash), expected.roundHashes);
    let enemyPaid = 0; const marks = new Set<string>();
    for (const round of rounds) {
      const o = round.apocalypseDemonessOutcome!; expect(o).toBeDefined(); expect(round.stance).toBe('CONTROL');
      same(replayApocalypseDemonessCombatRound(o.source, round.stance).round, round);
      expect(o.targetId).toBe('AD1-LEONA'); expect(o.source.root.siteId).toBe('AD1-ADJACENT-YARD'); expect(o.source.root.thirdPartiesInArea).toBe(0);
      expect(round.playerCount).toBe(apocalypseDemonessActionCount(round.playerCountRoll));
      expect(round.enemyCount).toBe(apocalypseDemonessEnemyActionCount(round.enemyCountRoll));
      expect(o.playerActions).toHaveLength(round.playerCount); expect(o.enemyActions).toHaveLength(round.enemyCount);
      for (const a of [...o.playerActions, ...o.enemyActions]) {
        expect(a.elapsedSeconds).toBe(5); expect(a.randomCursorAfter).toBeGreaterThanOrEqual(a.randomCursorBefore);
        if (a.consumedMarkId) { expect(marks.has(a.consumedMarkId)).toBe(false); marks.add(a.consumedMarkId); expect(a.paidCost).toBe(7); }
        if (a.actor === 'PLAYER' && (a.selectedAbility === APOCALYPSE_DEMONESS_ABILITY_IDS[0] || a.selectedAbility === APOCALYPSE_DEMONESS_ABILITY_IDS[1]) && a.check) {
          expect([a.paidCost, a.mindCost]).toEqual([8, 2]); expect(a.masteryApplied).not.toContain(a.selectedAbility);
        }
        if (a.masteryApplied.includes(APOCALYPSE_DEMONESS_ABILITY_IDS[0])) {
          const w = a.windowsBefore.pulseContainment!; expect(a.actor).toBe('PLAYER'); expect(a.selectedAbility).toBe('STRIKE');
          expect(a.pendingSourceBefore?.observed).toBe(true); expect(a.pendingSourceBefore?.containmentUsed).toBe(false);
          expect(a.appliedWindowId).toBe(w.id); expect(w.openedOrder).toBeLessThan(a.order); expect(a.completedAtSeconds).toBeLessThan(w.expiresAt);
        }
        if (a.masteryApplied.includes(APOCALYPSE_DEMONESS_ABILITY_IDS[1])) {
          const w = a.windowsBefore.mirrorBuffer!; expect(a.actor).toBe('ENEMY'); expect(a.attackKind).toBe('BODY');
          expect(a.appliedWindowId).toBe(w.id); expect(w.openedOrder).toBeLessThan(a.order); expect(a.completedAtSeconds).toBeLessThan(w.expiresAt);
          expect(a.plateChargeSpent).toBe(1); expect(a.plateWear).toBe(5);
        }
      }
      enemyPaid += sum(o.enemyActions, a => a.paidCost); expect(o.enemySpirituality).toBe(120 - enemyPaid);
      expect(o.materialsAfter.marks.filter(m => m.status === 'SPENT')).toHaveLength(marks.size); expect(marks.size).toBeLessThanOrEqual(3);
      same(o.originalsAfter.combatPlate, original.calamityDemoness.encounter.plate);
      expect(o.rootAfter.clockSeconds - o.source.root.clockSeconds).toBe(60);
      expect(o.source.playerSpirituality - o.playerSpiritualityAfter).toBe(sum(o.playerActions, a => a.paidCost));
    }
    const actions = rounds.flatMap(r => [...r.apocalypseDemonessOutcome!.playerActions, ...r.apocalypseDemonessOutcome!.enemyActions]);
    same(Object.fromEntries(APOCALYPSE_DEMONESS_ABILITY_IDS.map(id => [id, {
      plannedSelections: actions.filter(a => a.actor === 'PLAYER' && a.planned === id).length,
      paidAttempts: actions.filter(a => a.actor === 'PLAYER' && a.selectedAbility === id && a.paidCost > 0).length,
      successfulChecks: actions.filter(a => a.actor === 'PLAYER' && a.selectedAbility === id && a.check && ['SUCCESS', 'GREAT_SUCCESS'].includes(a.check.tier)).length,
      actualApplications: actions.filter(a => a.masteryApplied.includes(id)).length,
    }])), expected.combatAbilityUse);
    // The one successful containment cast never helped a later strike in this
    // actual fight. Its life-only mastery stays8; buffer really applied once.
    expect(final.progression.mastery[APOCALYPSE_DEMONESS_ABILITY_IDS[0]]).toBe(8);
    expect(final.progression.mastery[APOCALYPSE_DEMONESS_ABILITY_IDS[1]]).toBe(16);
    expect(sum(actions, a => a.plateChargeSpent)).toBe(2);
    expect(actions.filter(a => a.selectedAbility === 'assassin.s2.mirror-screen' && a.plateChargeSpent === 1)).toHaveLength(1);
    expect(final.progression.mastery['assassin.s2.mirror-screen']).toBe(8);
    expect(final.apocalypseDemoness.encounter.materials.plate).toMatchObject({ id: 'AD1-COMBAT-PLATE', paidPennies: 20, charges: 1, wear: 5 });
    expect(final.apocalypseDemoness.encounter.terminal).toMatchObject(expected.terminal); originals(final, original);
  }, 60_000);

  it('reopens the actual final outcome without inventing a success, death, exit or later action', () => {
    const final = state('final'), before = state('beforeLast'), last = entry<SliceIntent>('lastIntent');
    same(last, commands.at(-1)); same(applySliceIntent(before, last), final);
    const reopened = current(JSON.parse(JSON.stringify(final))); assertValidSliceState(reopened); same(reopened, final);
    same(body(reopened), expected.final); same(projectSliceState(reopened), projectSliceState(final));
    expect(reopened.status).toBe(expected.final.status);
    expect(last).toEqual({ type: 'ACTION', action: 'WORK' }); expect(reopened.status).toBe('ACTIVE');
    expect(reopened.progression.sequence).toBe(1); expect(reopened.progression.acting).toBe(100);
    expect(reopened.apocalypseDemoness.encounter.terminal).toMatchObject({ outcome: 'ENEMY_SURRENDERED', round: 4, enemyHealth: 70, enemyMind: 100, enemySpirituality: 96, exitMetres: 4, exitSeconds: 4 });
    expect(reopened.combat).toBeNull(); expect(reopened.apocalypseDemoness.encounter.scene.playerLocation).toBe('OUTSIDE');
    expect([site(reopened).playerLocation, site(reopened).vera.location, site(reopened).marcus.location]).toEqual(['OUTSIDE', 'OUTSIDE', 'OUTSIDE']);
    expect(projectSliceState(reopened).canAct).toBe(true); expect(reopened.injuries.map(i => i.severity)).toEqual(['LIGHT', 'LIGHT']);
    same(before.injuries, reopened.injuries); expect(before.health).toBe(reopened.health);
    expect(reopened.cash - before.cash).toBe(reopened.character.weeklyWage); expect(before.actionsRemaining - reopened.actionsRemaining).toBe(1);
    expect(steps['actual-ordinary-encounter-exit']).toBe(853); expect(steps['actual-work-after-living-exit']).toBe(854);
  }, 60_000);
});
