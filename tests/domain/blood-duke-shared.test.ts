import { createHash } from 'node:crypto';
import { createReadStream, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { createBloodDukeState } from '../../src/domain/blood-duke/index.js';
import { BLOOD_DUKE_ABILITY_IDS, BLOOD_DUKE_PREPARATION_IDS } from '../../src/domain/blood-duke/types.js';
import { BLOOD_DUKE_CASE_IDS, bloodDukeLifeClosed } from '../../src/domain/blood-duke/life.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const directory = 'tests/fixtures/blood-duke-v01800';
const naturalPath = `${directory}/natural.json`;
const originalPath = 'tests/fixtures/blatherer-v01560/natural.json';
const originalSha256 = '796a7efabb26d5db70a24eeb509d7bbe2d80aa33e864f2ff45eba65016abaf7b';
const roots = ['criminal', 'unwinged', 'serialKiller', 'demon', 'desireApostle', 'devil', 'blatherer'] as const;
const entry = <T>(key: string): T => readObjectEntry<T>(naturalPath, key);
const prefix = (): SliceState => entry<SliceState>('prefixFinal');
const final = (): SliceState => entry<SliceState>('final');
const snapshot = (name: 'promoted' | 'practiced' | 'combatStart' | 'departure'): SliceState =>
  JSON.parse(readFileSync(`${directory}/snapshot-${name}.json`, 'utf8')) as SliceState;

function boundary(name: string) {
  const path = `${directory}/boundary-${name}.json`;
  return {
    beforeLast: readObjectEntry<SliceState>(path, 'beforeLast'),
    lastIntent: readObjectEntry<SliceIntent>(path, 'lastIntent'),
    final: readObjectEntry<SliceState>(path, 'final'),
  };
}

describe('Blood Duke actual saved public continuation', () => {
  it('preserves the exact source hash and 583-command living fork beside the unchanged 592-command old death', async () => {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(originalPath)) hash.update(chunk);
    expect(hash.digest('hex')).toBe(originalSha256);
    expect(entry('provenance')).toEqual({ kind: 'SAME_SEED_PUBLIC_LIVING_FORK_BEFORE_OPTIONAL_COMBAT', source: originalPath, sourceSha256: originalSha256, newRandomChanges: false });
    const commands = entry<SliceIntent[]>('commands'), oldCommands = readObjectEntry<SliceIntent[]>(originalPath, 'commands');
    expect(commands).toHaveLength(724); expect(oldCommands).toHaveLength(592);
    expect(entry('prefixCount')).toBe(583); expect(entry('prefixVerified')).toBe(true);
    expect(commands.slice(0, 583)).toEqual(oldCommands.slice(0, 583));
    expect(oldCommands[583]).toEqual({ type: 'BLATHERER', command: { type: 'ENCOUNTER_TALK' } });
    expect(commands[583]).toEqual({ type: 'BLOOD_DUKE', command: { type: 'LEARN_GUIDANCE' } });
    expect(entry('creation')).toEqual(readObjectEntry(originalPath, 'creation'));
    expect(entry('seed')).toBe(readObjectEntry(originalPath, 'seed')); expect(entry('seed')).toBe('criminal-natural-v054');
    expect(readObjectEntry<SliceState>(originalPath, 'final')).toMatchObject({ revision: 593, status: 'DEAD', health: 0, ending: { kind: 'DEATH' } });
    const s = prefix(); expect(s).toEqual(snapshot('departure'));
    expect(s).toMatchObject({ revision: 584, week: 154, status: 'ACTIVE', health: 100, mind: 100, spirituality: 120, cash: 500,
      actionsRemaining: 3, random: { seed: 'criminal-natural-v054', cursor: 106 }, progression: { sequence: 3, acting: 100 } });
    expect(s.bloodDuke).toEqual(createBloodDukeState()); assertValidSliceState(s);
  });

  it('keeps seven original acquisitions and all 14 mastery values, adding only two zero skills without a resource refill', () => {
    const old = prefix(), s = snapshot('promoted'), terminal = final();
    expect(Object.keys(old.progression.mastery)).toHaveLength(14);
    for (const key of roots) {
      expect(s[key], key).toEqual(old[key]);
      expect(s[key].bottles.filter(b => ['SUCCESS', 'GREAT_SUCCESS'].includes(b.outcome ?? ''))).toHaveLength(1);
      if (key !== 'blatherer') expect(terminal[key], key).toEqual(old[key]);
    }
    const { life: oldLife, ...oldBlatherer } = old.blatherer;
    const { life: _actualRoom, ...actualBlatherer } = terminal.blatherer;
    expect(actualBlatherer).toEqual(oldBlatherer); expect(terminal.bloodDuke.life.source?.snapshot).toEqual(oldLife);
    expect(terminal.combatHistory.slice(0, old.combatHistory.length)).toEqual(old.combatHistory);
    for (const [id, mastery] of Object.entries(old.progression.mastery)) {
      expect(s.progression.mastery[id], id).toBe(mastery); expect(terminal.progression.mastery[id], id).toBe(mastery);
    }
    expect(Object.keys(s.progression.mastery).filter(id => !Object.hasOwn(old.progression.mastery, id))).toEqual([...BLOOD_DUKE_ABILITY_IDS]);
    for (const id of BLOOD_DUKE_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    expect(s.progression).toMatchObject({ sequence: 2, acting: 0, promotionWeek: old.progression.promotionWeek });
    expect(s.bloodDuke).toMatchObject({ promotionWeek: 172, blathererActingAtPromotion: 100 });
    expect(s.bloodDuke.promotionWeek! - old.blatherer.promotionWeek!).toBeGreaterThanOrEqual(12);
    const dose = s.bloodDuke.acquisitionJournal.at(-1)!;
    expect(dose.after.health).toBe(dose.before.health); expect(dose.after.spirituality).toBe(dose.before.spirituality);
    expect(s.mind).toBe(dose.before.mind - 15);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(Math.min(500, old.character.coreStats[stat] + 1));
    expect(s.character.gender).toBe(old.character.gender); expect(s.unwinged.conscienceLost).toBe(true);
    expect(s.devil.life.invitation.declined).toBe(true);
    expect(s.devil.encounter).toMatchObject({ targetId: 'DV4-ORRICK-FANE', enemyStatus: 'SURRENDERED', enemyHealth: 70, enemySpirituality: 32 });
    expect(s.blatherer.encounter.status).toBe('AVAILABLE'); assertValidSliceState(s); assertValidSliceState(terminal);
  });

  it('retains the first real failed dose and second success with separate labour, payments, preparations and RNG draws', () => {
    const s = snapshot('promoted'), journal = s.bloodDuke.acquisitionJournal;
    expect(s.bloodDuke.preparations.map(p => p.taskId)).toEqual([...BLOOD_DUKE_PREPARATION_IDS]);
    expect(s.bloodDuke.preparedWeek).toBeNull();
    expect(journal[0]!.before.cash - journal[0]!.after.cash).toBe(500);
    const preparations = journal.filter(e => e.command.type === 'PREPARE_PROMOTION');
    expect(preparations).toHaveLength(2);
    for (const e of preparations) {
      expect(e.before.cash - e.after.cash).toBe(140); expect(e.before.actions - e.after.actions).toBe(1);
    }
    const doses = journal.filter(e => e.command.type === 'CONSUME');
    expect(doses.map(e => [e.week, e.check?.tier, e.check?.roll, e.randomBefore, e.randomAfter])).toEqual([
      [164, 'FAILURE', 50, 106, 107], [172, 'SUCCESS', 31, 107, 108],
    ]);
    expect(doses[0]!.after).toMatchObject({ sequence: 3, acting: 100, health: 85, mind: 75, pollution: 30 });
    expect(doses[1]!.before).toMatchObject({ health: 100, mind: 100, spirituality: 120, pollution: 0 });
    expect(doses[1]!.after).toMatchObject({ sequence: 2, acting: 0, health: 100, mind: 85, spirituality: 120 });
    for (const [index, e] of doses.entries()) {
      const bottleId = `blood-duke-potion-${index + 1}`;
      const work = journal.filter(row => row.command.type === 'POTION_WORK' && row.command.bottleId === bottleId);
      expect(work).toHaveLength(5); for (const row of work) expect(row.before.actions - row.after.actions).toBe(1);
      const purchase = journal.find(row => row.command.type === 'BUY_POTION' && row.command.bottleId === bottleId)!;
      expect(purchase.before.cash - purchase.after.cash).toBe(900); expect(purchase.after.actions).toBe(purchase.before.actions);
      expect(s.bloodDuke.bottles[index]).toMatchObject({ id: bottleId, status: 'CONSUMED', labourSteps: 5, preparationWeek: e.week, consumedWeek: e.week, outcome: e.check!.tier });
      expect(preparations[index]!.week).toBe(e.week); expect(e.after.cash).toBe(e.before.cash); expect(e.after.actions).toBe(e.before.actions);
    }
    expect(s.bloodDuke.bottles[2]).toMatchObject({ status: 'SUPPLIER', acquiredWeek: null, consumedWeek: null, outcome: null });
  });

  it('awards eight mastery for each actual life application while the failed third emotion uses manual closure and withdrawal in the original room', () => {
    const old = prefix(), s = snapshot('practiced'), life = s.bloodDuke.life, room = s.blatherer.life;
    expect(s.progression.acting).toBe(100); expect(life.reflected).toBe(true); expect(bloodDukeLifeClosed(s)).toBe(true);
    expect(Object.keys(life.cases)).toEqual([...BLOOD_DUKE_CASE_IDS]);
    const attempts = BLOOD_DUKE_CASE_IDS.map(id => {
      expect(life.cases[id]).toMatchObject({ status: 'RESOLVED', contactOpen: false, returned: true });
      expect(life.cases[id].attempts).toHaveLength(1); return life.cases[id].attempts[0]!;
    });
    expect(attempts[0]).toMatchObject({ selfRestraintTier: 'SUCCESS', emotionTier: null, result: 'ABILITY', spiritualitySpent: 6, mindSpent: 2, appliedAbilityIds: [BLOOD_DUKE_ABILITY_IDS[0]] });
    expect(attempts[1]).toMatchObject({ selfRestraintTier: null, emotionTier: 'SUCCESS', result: 'ABILITY', spiritualitySpent: 6, mindSpent: 2, appliedAbilityIds: [BLOOD_DUKE_ABILITY_IDS[1]] });
    expect(attempts[2]).toMatchObject({ selfRestraintTier: 'SUCCESS', emotionTier: 'FAILURE', result: 'ORDINARY', manual: true, performed: false,
      consent: 'WITHDRAWN', permissionWithdrawn: true, stopped: true, spiritualitySpent: 12, mindSpent: 6, appliedAbilityIds: [] });
    for (const id of BLOOD_DUKE_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(8);
    for (const attempt of attempts) {
      expect(attempt).toMatchObject({ closed: true, cardTaken: true, cardReturned: true, noteRead: true, expired: true, inspected: true, playerTravelMetres: 16 });
      expect(attempt.playerMoves.map(move => [move.metres, move.seconds])).toEqual([[4, 4], [4, 4], [4, 4], [4, 4]]);
    }
    expect(life.source?.snapshot).toEqual(old.blatherer.life); expect(room.cases).toEqual(old.blatherer.life.cases);
    for (const key of ['siteId', 'volunteer', 'guide', 'bell', 'note'] as const) expect(room[key]).toEqual(old.blatherer.life[key]);
    expect(room.volunteer).toMatchObject({ id: 'BL3-NORA', age: 46, alive: true, location: 'A' });
    expect(room.card).toEqual({ ...old.blatherer.life.card, travelMetres: old.blatherer.life.card.travelMetres + 24 });
    expect(room.playerTravelMetres).toBe(old.blatherer.life.playerTravelMetres + 48); expect(room.playerLocation).toBe('START');
    expect(life.operation).toMatchObject({ door: 'OPEN', inputActive: false, restraintUntil: null, hesitationUntil: null, impulse: null, emotion: null });
    assertValidSliceState(s);
  });

  it('preserves three BODY combat rounds without claiming new S2 draws, including the real 96 on the 65/30/5 death wheel', () => {
    const s = final(), rounds = s.combatHistory.filter(round => round.bloodDukeOutcome);
    expect(rounds).toHaveLength(3); expect(rounds.map(round => round.consequenceDomain)).toEqual(['BODY', 'BODY', 'BODY']);
    expect(rounds.map(round => round.winner)).toEqual(['ENEMY', 'PLAYER', 'ENEMY']);
    for (const round of rounds) {
      const outcome = round.bloodDukeOutcome!;
      expect(outcome.source).toMatchObject({ targetId: 'BD2-GARETH', enemyWeapon: 'BD2-GARETH-SWORD', actualBody: true, independentMind: true });
      expect(outcome.playerActions.some(action => (BLOOD_DUKE_ABILITY_IDS as readonly string[]).includes(action.id))).toBe(false);
      expect(outcome.restraintAttempted).toBe(false); expect(outcome.interferenceAttempted).toBe(false);
      expect(outcome.enemyActions.every(action => action.attackKind === 'NONE' || action.attackKind === 'BODY')).toBe(true);
      expect(outcome.enemySpirituality).toBe(outcome.enemySpiritualityBefore - outcome.enemyActions.reduce((sum, action) => sum + action.paidCost, 0));
    }
    const last = rounds.at(-1)!;
    expect(last.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 }); expect(last.consequence).toContain('96/100');
    const rng = new DeterministicActionRandomStream(s.random.seed, s.random.cursor - 1);
    expect(rng.nextInt(1, 100)).toBe(96); expect(rng.cursor).toBe(s.random.cursor);
    expect(s).toMatchObject({ status: 'DEAD', week: 181, health: 0, mind: 97, spirituality: 116, combat: null,
      random: { seed: 'criminal-natural-v054', cursor: 140 }, ending: { kind: 'DEATH' } });
    expect(s.bloodDuke.encounter).toMatchObject({ status: 'LOST', enemyHealth: 100, enemyMind: 100, enemySpirituality: 96,
      terminal: { outcome: 'PLAYER_DEAD', round: 3, exitMetres: 0, exitSeconds: 0 } });
    expect(s.blatherer.life.volunteer).toMatchObject({ id: 'BL3-NORA', alive: true, location: 'OUTSIDE' });
  });

  it('loads both actual dead endings without revival and rejects new commands without modifying their stored states', () => {
    for (const raw of [readObjectEntry<SliceState>(originalPath, 'final'), final()]) {
      const input = JSON.stringify(raw), s = migrateSliceState(raw), saved = JSON.stringify(s);
      expect(s).toMatchObject({ schemaVersion: 177, contentVersion: 'blood-duke-v177', status: 'DEAD', health: 0, ending: { kind: 'DEATH' } });
      for (const key of [...roots, 'random', 'progression', 'combatHistory', 'week', 'cash', 'mind', 'spirituality'] as const) expect(s[key]).toEqual(raw[key]);
      const commands: SliceIntent[] = [
        { type: 'BLOOD_DUKE', command: { type: 'LEARN_GUIDANCE' } },
        { type: 'BLOOD_DUKE', command: { type: 'PREPARE_PROMOTION' } },
        { type: 'BLOOD_DUKE', command: { type: 'ENCOUNTER_FIGHT' } },
        { type: 'ACTION', action: 'REST' },
      ];
      for (const command of commands) expect(() => applySliceIntent(s, command)).toThrow();
      expect(JSON.stringify(raw)).toBe(input); expect(JSON.stringify(s)).toBe(saved);
      expect(migrateSliceState(s)).toEqual(s); assertValidSliceState(s);
    }
  });

  it('replays the real last indexed boundary to the exact final save without mutating input or intent', () => {
    const index = JSON.parse(readFileSync(`${directory}/boundaries.index.json`, 'utf8')) as Record<string, string>;
    expect(Object.keys(index)).toHaveLength(64); expect(new Set(Object.values(index)).size).toBe(64);
    expect(index['combat-round-3']).toBe('boundary-combat-round-3.json');
    const b = boundary('combat-round-3'), input = JSON.stringify(b.beforeLast), intent = JSON.stringify(b.lastIntent);
    expect(b.beforeLast.status).toBe('ACTIVE'); expect(b.lastIntent).toEqual({ type: 'COMBAT_ROUND', stance: 'ATTACK' });
    expect(entry<SliceIntent[]>('commands').at(-1)).toEqual(b.lastIntent);
    const replayed = applySliceIntent(b.beforeLast, b.lastIntent);
    expect(replayed).toEqual(b.final); expect(replayed).toEqual(final()); assertValidSliceState(replayed);
    expect(JSON.stringify(b.beforeLast)).toBe(input); expect(JSON.stringify(b.lastIntent)).toBe(intent);
  }, 30_000);

  it('deep-clones saved state and public life/combat projections without rewriting original people, objects or journals', () => {
    const s = snapshot('combatStart'), stored = JSON.stringify(s), copy = structuredClone(s), view = projectSliceState(s);
    expect(view.maxSpirituality).toBe(120); expect(view.bloodDuke.abilities).toHaveLength(16);
    for (const key of roots) expect(view[key].acting).toBe(100);
    copy.bloodDuke.life.source!.snapshot.volunteer.name = 'changed clone';
    copy.bloodDuke.acquisitionJournal[0]!.after.cash++;
    view.bloodDuke.abilities[0]!.mastery++;
    view.bloodDuke.life.site.card.travelMetres++;
    view.bloodDuke.life.cases[0]!.attempts[0]!.evidence.push('changed view');
    view.bloodDuke.encounter.preparation!.after.mind++;
    view.bloodDuke.encounter.enemy!.powerUses.SILVER_ARMOR++;
    expect(JSON.stringify(s)).toBe(stored); expect(snapshot('combatStart')).toEqual(s); assertValidSliceState(s);
  });
});
