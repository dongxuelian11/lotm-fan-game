import { describe, expect, it } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { applySliceIntent, assertValidSliceState, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { validateSlicePayload } from '../../src/domain/slice/validation.js';
import type { SliceState, SliceIntent } from '../../src/domain/slice/types.js';
import { createFateTrojanState, hasFateTrojanHistory, validateFateTrojanState } from '../../src/domain/fate-trojan/index.js';
import { FATE_TROJAN_ABILITY_IDS } from '../../src/domain/fate-trojan/types.js';
import { validateFateTrojanLife } from '../../src/domain/fate-trojan/life.js';
import { validateFateTrojanEncounter } from '../../src/domain/fate-trojan/encounter.js';
import { validateFateTrojanCombatRound, validateFateTrojanRoundOutcome } from '../../src/domain/fate-trojan/combat.js';
import { deceitMentorPeacefulPath, peacefulStart, oldErrorRoots, errorLegacyKeys, rejectIntent } from './fate-trojan-directed-helper.js';
import { actualSnapshot, actualBoundary, actualBoundaryNames, fateTrojanFixturePath } from './fate-trojan-fixture-helper.js';
const prior = () => readObjectEntry<SliceState>(deceitMentorPeacefulPath, 'final');
function preserved(s: SliceState): void {
  const before = prior(); expect(oldErrorRoots(s)).toEqual(oldErrorRoots(before)); expect(s.character.gender).toBe(before.character.gender);
  expect(s.runId).toBe(before.runId); expect(s.random.seed).toBe(before.random.seed); expect(s.combatHistory.slice(0, before.combatHistory.length)).toEqual(before.combatHistory);
  for (const [id, mastery] of Object.entries(before.progression.mastery)) expect(s.progression.mastery[id], id).toBe(mastery);
}

describe('Fate Trojan shared state, exact old history and genuine natural continuation', () => {
  it('initializes a closed independent root without making a new ordinary player an S2 actor', () => {
    const creation = readObjectEntry<Parameters<typeof createSliceRun>[1]>(fateTrojanFixturePath, 'creation'), s = createSliceRun('fate-trojan-empty-unit', creation, 'fate-trojan-empty-unit');
    expect(s.fateTrojan).toEqual(createFateTrojanState()); expect(hasFateTrojanHistory(s)).toBe(false); expect(validateFateTrojanState(s)).toBe(true);
    const p = projectSliceState(s); expect(p.fateTrojan.promoted).toBe(false); expect(p.fateTrojan.actions).toEqual([]); expect(p.fateTrojan.abilities).toEqual([]); assertValidSliceState(s);
  });
  it('migrates the complete original 451-command living source without treating wounds, rewriting the next RNG or changing prior roots', () => {
    const raw = prior(), frozen = structuredClone(raw), s = migrateSliceState(raw);
    expect(raw).toEqual(frozen); expect(s.fateTrojan).toEqual(createFateTrojanState()); expect(s.random).toEqual({ seed: 'marauder-natural-v038', cursor: 253 });
    expect(s).toMatchObject({ week: 108, health: 100, mind: 100, spirituality: 120, cash: 530, progression: { pathwayId: 'error', sequence: 3, acting: 100 } });
    for (const key of ['injuries', 'injuryRisk', 'character', 'town', 'combatHistory', ...errorLegacyKeys] as const) expect(s[key], key).toEqual(raw[key]);
    expect(migrateSliceState(s)).toEqual(s); expect(s.injuries.filter(i => i.severity === 'HEAVY' && i.treatedRevision === null)).toHaveLength(2); assertValidSliceState(s);
  });
  it('replays the full 551 commands from new creation, proving the exact 451 prefix and unchanged original seed', () => {
    const commands = readObjectEntry<SliceIntent[]>(fateTrojanFixturePath, 'commands'), prefix = readObjectEntry<SliceIntent[]>(deceitMentorPeacefulPath, 'commands');
    const creation = readObjectEntry<Parameters<typeof createSliceRun>[1]>(fateTrojanFixturePath, 'creation'), seed = readObjectEntry<string>(fateTrojanFixturePath, 'seed');
    expect(prefix).toHaveLength(451); expect(commands).toHaveLength(551); expect(commands.slice(0, 451)).toEqual(prefix); expect(seed).toBe(prior().random.seed);
    expect(readObjectEntry(fateTrojanFixturePath, 'creation')).toEqual(readObjectEntry(deceitMentorPeacefulPath, 'creation'));
    let s = createSliceRun(prior().runId, creation, seed);
    for (const [index, command] of commands.entries()) {
      expect(validateSlicePayload(command), String(index)).toBe(true); s = applySliceIntent(s, command);
      if (index === 450) expect(s).toEqual(peacefulStart());
    }
    expect(s).toEqual(actualSnapshot()); expect(s.random).toEqual({ seed: 'marauder-natural-v038', cursor: 361 }); preserved(s); assertValidSliceState(s);
  }, 120_000);
  it('replays every actual named before/intent/after boundary with immutable input and valid full state', () => {
    const names = actualBoundaryNames(); expect(names).toHaveLength(58);
    for (const name of names) {
      const b = actualBoundary(name), frozen = structuredClone(b.beforeLast); expect(validateSlicePayload(b.lastIntent), name).toBe(true);
      expect(applySliceIntent(b.beforeLast, b.lastIntent), name).toEqual(b.final); expect(b.beforeLast, name).toEqual(frozen); assertValidSliceState(b.final);
    }
  }, 120_000);
  it('retains all fourteen actual abilities, old acting and current gender while closing old public acquisition/actions', () => {
    const s = actualSnapshot('promoted'), p = projectSliceState(s); preserved(s); expect(Object.keys(s.progression.mastery)).toHaveLength(14);
    expect(p.fateTrojan.abilities.map(a => a.id).sort()).toEqual(Object.keys(s.progression.mastery).sort()); expect(FATE_TROJAN_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
    expect(p.fateTrojan).toMatchObject({ title: '命运木马·错误序列2', promoted: true, formulaKnown: false, formula: [], currentGender: s.character.gender });
    expect(p.maxSpirituality).toBe(120); expect(s.fateTrojan.deceitMentorActingAtPromotion).toBe(100); expect(p.deceitMentor.acting).toBe(100);
    for (const key of errorLegacyKeys) expect(p[key].actions.filter(a => a.enabled), key).toEqual([]);
    for (const type of ['MARAUDER', 'SWINDLER', 'CRYPTOLOGIST', 'FIRE_THIEF', 'DREAM_STEALER', 'PARASITE', 'DECEIT_MENTOR'] as const)
      rejectIntent(s, { type, command: { type: 'LEARN_GUIDANCE' } } as SliceIntent);
  });
  it('keeps the original seven stages visible but closes their actual life and potion commands at S2', () => {
    const s = actualSnapshot('promoted');
    const stages = [
      ['MARAUDER', 'training-purse', 'marauder-potion-2'], ['SWINDLER', 'rehearsed-message', 'swindler-potion-2'],
      ['CRYPTOLOGIST', 'ledger-sequence', 'cryptologist-potion-2'], ['FIRE_THIEF', 'borrowed-flash', 'fire-thief-potion-2'],
      ['DREAM_STEALER', 'announced-seat', 'dream-stealer-potion-2'], ['PARASITE', 'shared-senses', 'parasite-potion-2'],
      ['DECEIT_MENTOR', 'spent-lamp', 'deceit-mentor-potion-2'],
    ] as const;
    for (const [type, caseId, bottleId] of stages) {
      rejectIntent(s, { type, command: { type: 'OBSERVE', caseId } } as SliceIntent);
      for (const commandType of ['POTION_WORK', 'BUY_POTION'] as const)
        rejectIntent(s, { type, command: { type: commandType, bottleId } } as SliceIntent);
    }
    preserved(s);
  });
  it('does not reopen old parasite labour or purchase on either genuine S3 or new S2', () => {
    for (const s of [peacefulStart(), actualSnapshot('promoted')]) {
      expect(s.parasite.bottles.find(b => b.id === 'parasite-potion-2')).toMatchObject({ status: 'SUPPLIER', labourSteps: 0 });
      for (const type of ['POTION_WORK', 'BUY_POTION'] as const) {
        const intent = { type: 'PARASITE', command: { type, bottleId: 'parasite-potion-2' } } as const;
        expect(validateSlicePayload(intent)).toBe(true); rejectIntent(s, intent);
      }
    }
  });
  it('real current clinic care pays sixty, marks the two original heavy wounds, and only later rest heals', () => {
    const b = actualBoundary('clinic-actual-pay60'); expect(b.beforeLast.injuries.filter(i => i.severity === 'HEAVY' && i.treatedRevision === null)).toHaveLength(2);
    expect(b.final.cash).toBe(b.beforeLast.cash - 60); expect(b.final.health).toBe(b.beforeLast.health); expect(b.final.injuryRisk).toBe(b.beforeLast.injuryRisk);
    expect(b.final.injuries.map(i => i.id)).toEqual(b.beforeLast.injuries.map(i => i.id)); expect(b.final.injuries.every(i => i.treatedRevision !== null)).toBe(true);
    const healed = actualBoundary('clinic-both-original-heavy-wounds-healed').final; expect(healed.injuries).toEqual([]); expect(healed.injuryRisk).toBe(0); preserved(healed);
  });
  it('the actual two life applications award 8/8 and the later nine combat rounds add none', () => {
    const p = actualSnapshot('practiced'), final = actualSnapshot(); expect(p.progression.acting).toBe(100); expect(FATE_TROJAN_ABILITY_IDS.map(id => p.progression.mastery[id])).toEqual([8, 8]);
    expect(final.progression.mastery).toEqual(p.progression.mastery); expect(final.fateTrojan.life.journal).toEqual(p.fateTrojan.life.journal);
    expect(p.fateTrojan.life.site).toMatchObject({ playerEnergy: 15, playerTravelMetres: 80, parcel: { id: 'FT2-PARCEL', quantity: 1, location: 'OUTSIDE', ordinaryMetres: 8 }, fate: { paidToPlayer: 12, incurredHealth: 5, incurredEnergy: 5 } });
    expect(p.fateTrojan.life.cases['revoked-link'].attempts[0]).toMatchObject({ permissionWithdrawn: true, identityTaken: false, abilityTier: null, appliedAbilityIds: [] }); preserved(final);
  });
  it('replays all nine saved natural rounds in order, preserving exact costs, injuries and the terminal exit', () => {
    let s = actualSnapshot('combatStart'); const originalMastery = structuredClone(s.progression.mastery);
    for (let n = 1; n <= 9; n++) {
      const b = actualBoundary(`combat-round-${n}`); expect(s).toEqual(b.beforeLast); s = applySliceIntent(s, b.lastIntent); expect(s).toEqual(b.final);
      const r = s.combatHistory.at(-1)!, o = r.fateTrojanOutcome!; expect(validateFateTrojanRoundOutcome(o)).toBe(true); expect(validateFateTrojanCombatRound(r)).toBe(true);
      expect(r.consequenceDomain).toBe('BODY'); expect(s.progression.mastery).toEqual(originalMastery);
      expect(o.playerSpiritualityAfter).toBe(o.source.playerSpirituality - o.playerActions.reduce((sum, a) => sum + a.paidCost, 0));
      expect(o.enemySpirituality).toBe(o.source.enemySpirituality - o.enemyActions.reduce((sum, a) => sum + a.paidCost, 0));
      expect(validateFateTrojanLife(s)).toBe(true); expect(validateFateTrojanEncounter(s)).toBe(true);
    }
    expect(s).toMatchObject({ status: 'ACTIVE', health: 40, combat: null }); expect(s.fateTrojan.encounter).toMatchObject({ status: 'RETREATED', enemySpirituality: 55, terminal: { outcome: 'RETREATED', round: 9, exitMetres: 2, playerEnergyPaid: 2 } });
    expect(s.fateTrojan.life.site).toMatchObject({ playerLocation: 'OUTSIDE', playerTravelMetres: 86, playerEnergy: 9 }); assertValidSliceState(s);
  }, 120_000);
  it('honestly preserves unused paid natural fate windows instead of claiming the directed 85 was applied in this capture', () => {
    const final = actualSnapshot(), rounds = final.combatHistory.filter(r => r.fateTrojanOutcome), fate = rounds.flatMap(r => r.fateTrojanOutcome!.playerActions).filter(a => a.id === 'error.s2.fate-assumption' && a.attempted);
    expect(rounds).toHaveLength(9); expect(fate).toHaveLength(2); for (const a of fate) expect(a).toMatchObject({ succeeded: true, paidCost: 7, healthPaid: 5, applied: false, appliedAmount: 0, chargeConsumedByOrder: null });
    const links = rounds.flatMap(r => r.fateTrojanOutcome!.playerActions).filter(a => a.id === 'error.s2.identity-link' && a.applied);
    expect(links).toHaveLength(2); expect(links.map(a => a.appliedAmount)).toEqual([30, 30]);
  });
  it('permits real ordinary work only after physical terminal exit and does not reset any enemy, injury or object', () => {
    const b = actualBoundary('ordinary-life-after-actual-exit'); expect(b.lastIntent).toEqual({ type: 'ACTION', action: 'WORK' });
    expect(b.beforeLast.combat).toBeNull(); expect(b.beforeLast.fateTrojan.life.site.playerLocation).toBe('OUTSIDE');
    expect(b.final.cash).toBeGreaterThan(b.beforeLast.cash); expect(b.final.fateTrojan).toEqual(b.beforeLast.fateTrojan);
    expect(b.final.injuries).toEqual(b.beforeLast.injuries); expect(b.final.injuryRisk).toBe(b.beforeLast.injuryRisk); expect(b.final.health).toBe(40); preserved(b.final);
  });
  it('detaches the full projection including inherited mastery, original bottles, current scene and enemy', () => {
    const s = actualSnapshot(), frozen = structuredClone(s), p = projectSliceState(s);
    p.fateTrojan.abilities[0]!.mastery++; p.fateTrojan.life.site.playerEnergy++; p.fateTrojan.encounter.enemy!.spirituality++;
    p.fateTrojan.life.cases[0]!.attempts[0]!.siteAtStart.parcel.ordinaryMetres++;
    expect(s).toEqual(frozen); expect(p.fateTrojan.inheritedHistory.join('')).toContain('原宿主'); expect(p.fateTrojan.inheritedHistory.join('')).toContain('原吉迪恩');
  });
});

const sourceMutations: [string, (s: SliceState) => void][] = [
  ['missing original consumed bottle', s => { s.marauder.bottles = s.marauder.bottles.filter(b => b.status !== 'CONSUMED'); }],
  ['source chronology rewritten', s => { s.deceitMentor.promotionWeek = s.fateTrojan.promotionWeek!; }],
  ['old digestion rewritten', s => { s.parasite.dreamStealerActingAtPromotion = 99; }],
  ['missing inherited ability', s => { delete s.progression.mastery['error.s3.deep-deception']; }],
  ['invented inherited ability', s => { s.progression.mastery['error.s2.permanent-identity'] = 100; }],
  ['loose root extension', s => { Object.assign(s.fateTrojan, { freePower: true }); }],
  ['fake source bottle field', s => { Object.assign(s.fateTrojan.bottles[0]!, { copied: false }); }],
];
describe('Fate Trojan old source/history shapes remain authoritative at S2', () => {
  it.each(sourceMutations)('rejects %s', (_name, mutate) => {
    const s = actualSnapshot('promoted'); mutate(s); expect(validateFateTrojanState(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
  });
  it('rejects malformed and unknown public command fields instead of silently discarding them', () => {
    for (const command of [{ type: 'REFLECT', free: true }, { type: 'ENCOUNTER_FIGHT', confirmed: true }, { type: 'TAKE_IDENTITY', caseId: 'identity-link', owner: 'COPY' },
      { type: 'WALK', caseId: 'identity-link', to: 'YARD' }, { type: 'CONSUME', bottleId: 'fate-trojan-potion-1', confirmed: false }]) expect(validateSlicePayload({ type: 'FATE_TROJAN', command })).toBe(false);
  });
});
