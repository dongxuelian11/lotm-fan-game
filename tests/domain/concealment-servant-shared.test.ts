import { describe, expect, it } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { createSliceRun, applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { validateSlicePayload } from '../../src/domain/slice/validation.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { createConcealmentServantState } from '../../src/domain/concealment-servant/index.js';
import { CONCEALMENT_SERVANT_ABILITY_IDS } from '../../src/domain/concealment-servant/types.js';
import { CONCEALMENT_SERVANT_CASE_IDS } from '../../src/domain/concealment-servant/life.js';
import { FEAR_BISHOP_ENEMY_COUNT_WHEEL, FEAR_BISHOP_ENEMY_ABILITY_WHEEL } from '../../src/domain/fear-bishop/combat.js';
import { concealmentServantFixturePath, concealmentServantBoundaryNames, concealmentServantBoundary,
  concealmentServantSnapshot, darknessLegacyKeys, fearBishopFixturePath, unitBudget } from './concealment-servant-test-fixture.js';

function expectOriginalHistory(s: SliceState, old: SliceState) {
  for (const key of darknessLegacyKeys) expect(s[key], key).toEqual(old[key]);
  expect(s.combatHistory.slice(0, old.combatHistory.length)).toEqual(old.combatHistory);
  expect(s.character.gender).toBe(old.character.gender); expect(s.runId).toBe(old.runId); expect(s.random.seed).toBe(old.random.seed);
  expect(s.town).toEqual(old.town);
  for (const [id, mastery] of Object.entries(old.progression.mastery)) expect(s.progression.mastery[id], id).toBe(mastery);
  const spirit = structuredClone(s.spiritWarlock), oldSpirit = old.spiritWarlock;
  const rounds = s.combatHistory.slice(old.combatHistory.length).map(r => r.concealmentServantOutcome).filter(r => r !== undefined);
  expect(spirit.companion.deployments - oldSpirit.companion.deployments).toBe(rounds.reduce((n, r) => n + r.playerActions.filter(a => a.spiritOperation === 'DEPLOY').length, 0));
  expect(spirit.companion.recalls - oldSpirit.companion.recalls).toBe(rounds.filter(r => r.recalled).length);
  expect(spirit.companion.status).toBe('SEALED');
  spirit.companion.deployments = oldSpirit.companion.deployments; spirit.companion.recalls = oldSpirit.companion.recalls;
  expect(spirit).toEqual(oldSpirit);
}

describe('Concealment Servant original420 prefix, migration166 and shared runtime', () => {
  it('migrates the genuine W105 survivor without changing any existing field or healing its old injuries', () => {
    const original = readObjectEntry<SliceState>(fearBishopFixturePath, 'final'), bytes = JSON.stringify(original), s = migrateSliceState(original);
    expect(s.schemaVersion).toBe(175); expect(s.contentVersion).toBe('sage-v175');
    for (const key of Object.keys(original)) if (!['schemaVersion', 'contentVersion'].includes(key))
      { const expected = (original as unknown as Record<string, unknown>)[key];
        const actual = (s as unknown as Record<string, unknown>)[key];
        // Earlier stage migrations may add nested defaults (for example the
        // long-chapter handoff). Every original field must still be preserved.
        if (expected !== null && typeof expected === 'object') expect(actual, key).toMatchObject(expected);
        else expect(actual, key).toEqual(expected); }
    expect(s.concealmentServant).toEqual(createConcealmentServantState()); expect(s.injuries.map(i => i.severity)).toEqual(['HEAVY', 'LIGHT', 'LIGHT']);
    expect(s.injuries.every(i => i.treatedRevision === null)).toBe(true); expect(s.injuryRisk).toBe(3);
    expect(JSON.stringify(original)).toBe(bytes); assertValidSliceState(s); expect(migrateSliceState(s)).toEqual(s);
  });
  it('replays all420 unchanged original commands and the captured new public choices under the original seed', () => {
    const commands = readObjectEntry<SliceIntent[]>(concealmentServantFixturePath, 'commands');
    const oldCommands = readObjectEntry<SliceIntent[]>(fearBishopFixturePath, 'commands');
    expect(oldCommands).toHaveLength(420); expect(commands.slice(0, 420)).toEqual(oldCommands); expect(commands).toHaveLength(528);
    expect(readObjectEntry<number>(concealmentServantFixturePath, 'prefixCount')).toBe(420); expect(readObjectEntry<boolean>(concealmentServantFixturePath, 'prefixVerified')).toBe(true);
    expect(readObjectEntry<number>(fearBishopFixturePath, 'prefixCount')).toBe(291);
    const seed = readObjectEntry<string>(concealmentServantFixturePath, 'seed'); expect(seed).toBe('sleepless-natural-v020');
    expect(seed).toBe(readObjectEntry<string>(fearBishopFixturePath, 'seed'));
    const inherited = migrateSliceState(readObjectEntry<unknown>(fearBishopFixturePath, 'final'));
    const creation = readObjectEntry<Parameters<typeof createSliceRun>[1]>(concealmentServantFixturePath, 'creation');
    let s = createSliceRun(inherited.runId, creation, seed);
    for (const [index, intent] of commands.entries()) {
      expect(validateSlicePayload(intent), `command ${index + 1}`).toBe(true);
      const cursor = s.random.cursor, revision = s.revision; s = applySliceIntent(s, intent);
      expect(s.random.seed).toBe(seed); expect(s.random.cursor).toBeGreaterThanOrEqual(cursor); expect(s.revision).toBe(revision + 1); expect(s.weeklyBudget).toBe(3);
      if (index === 419) { expect(s).toEqual(inherited); expect(s).toEqual(concealmentServantSnapshot('departureStart')); }
    }
    assertValidSliceState(s); expect(s).toEqual(concealmentServantSnapshot('final'));
    expect(s).toMatchObject({ status: 'DEAD', week: 121, health: 0, mind: 100, spirituality: 115, cash: 420, injuryRisk: 2, random: { seed: 'sleepless-natural-v020', cursor: 432 } });
    expect(s.concealmentServant.encounter.terminal).toMatchObject({ outcome: 'PLAYER_DEAD', round: 8, historyIndex: 34, enemyHealth: 90, enemyMind: 100, enemySpirituality: 8, enemyStatus: 'RESISTING' });
    // Never substitute a successful conclusion for a real death or failed potion branch.
    const stage = readObjectEntry<string>(concealmentServantFixturePath, 'stage');
    if (s.status === 'DEAD') expect(stage).toBe('ACTUAL_COMBAT_DEATH');
    else expect(stage).toBe('FULL_NATURAL_BRANCH');
  }, 120000);
  it('replays every captured complete boundary individually without parsing a giant all-boundaries document', () => {
    const names = concealmentServantBoundaryNames(); expect(names).toHaveLength(49); expect(new Set(names).size).toBe(49);
    for (const key of ['inherited-full-s3-final', 'clinic-actual-discovery', 'clinic-pay60', 'treated-injury-later-rest', 'independent-guidance',
      'professional-check_boundary', 'professional-agree_return', 'professional-trace_limit', 'buy-independent-bottle', 'current-week-paid-preparation', 'promotion',
      'consented-box-concealment-outcome', 'consented-box-veil-outcome', 'consented-box-actual-box-move', 'consented-box-actual-next-weak-search',
      'owner-current-consent-withdrawn', 'actual-original-door-blocked', 'blocked-door-explicit-release', 'ordinary-unbolt-after-release',
      'consented-box-actual-ordinary-exit', 'withdrawn-consent-actual-ordinary-exit', 'blocked-door-actual-ordinary-exit', 'reflection',
      'original-enemy-approach', 'original-enemy-fight', 'combat-first', 'combat-terminal']) expect(names).toContain(key);
    for (const key of names) {
      const b = concealmentServantBoundary(key), bytes = JSON.stringify(b.beforeLast), intent = JSON.stringify(b.lastIntent);
      assertValidSliceState(b.beforeLast); assertValidSliceState(b.final);
      expect(applySliceIntent(b.beforeLast, b.lastIntent), key).toEqual(b.final);
      expect(JSON.stringify(b.beforeLast), key).toBe(bytes); expect(JSON.stringify(b.lastIntent), key).toBe(intent);
    }
  }, 120000);
  it('discovers the clinic, actually pays60 and preserves treatment identity until later ordinary rest', () => {
    const old = concealmentServantSnapshot('departureStart');
    expect(old).toMatchObject({ week: 105, health: 80, mind: 100, spirituality: 111, injuryRisk: 3, cash: 580, actionsRemaining: 3 });
    const discovery = concealmentServantBoundary('clinic-actual-discovery');
    expect(discovery.lastIntent).toEqual({ type: 'ACTION', action: 'INVESTIGATE', targetId: 'CARE-ACCESS-01' });
    expect(discovery.final.injuries).toEqual(discovery.beforeLast.injuries); expect(discovery.final.health).toBe(discovery.beforeLast.health);
    const paid = concealmentServantBoundary('clinic-pay60'); expect(paid.lastIntent).toMatchObject({ type: 'EVENT_CHOICE', choiceId: 'PAY' });
    // Weekly bills may share this boundary; the actual medical payment can never be waived.
    expect(paid.beforeLast.cash - paid.final.cash).toBeGreaterThanOrEqual(60);
    for (const wound of paid.beforeLast.injuries.filter(i => i.severity === 'HEAVY' && i.treatedRevision === null)) {
      const after = paid.final.injuries.find(i => i.id === wound.id); expect(after).toBeDefined(); expect(after!.treatedRevision).toBe(paid.final.revision);
    }
    const healed = concealmentServantBoundary('treated-injury-later-rest'); expect(healed.lastIntent).toEqual({ type: 'ACTION', action: 'REST' });
    expect(healed.final.injuries).toEqual([]); expect(healed.final.injuryRisk).toBe(0);
    expect(concealmentServantSnapshot('guidanceStart').injuries).toEqual([]); expectOriginalHistory(healed.final, old);
  });
  it('promotion preserves16 old mastery and exposes exactly18 current entries with new abilities initially zero', () => {
    const s = concealmentServantSnapshot('promoted'), old = concealmentServantSnapshot('departureStart'), view = projectSliceState(s);
    expect(s.progression).toMatchObject({ pathwayId: 'darkness', sequence: 2, acting: 0, promotionWeek: 5 });
    expect(s.concealmentServant.fearBishopActingAtPromotion).toBe(100); expect(s.concealmentServant.promotionWeek! - s.fearBishop.promotionWeek!).toBeGreaterThanOrEqual(12);
    expect(Object.keys(s.progression.mastery)).toHaveLength(18); expect(CONCEALMENT_SERVANT_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
    expect(view.concealmentServant.abilities.map(a => a.id).sort()).toEqual(Object.keys(s.progression.mastery).sort());
    expect(new Set(view.concealmentServant.abilities.map(a => a.id)).size).toBe(18);
    expect(view.concealmentServant).toMatchObject({ formulaKnown: false, formula: [], promoted: true, currentGender: 'FEMALE' });
    expect(view.maxSpirituality).toBe(120); expect(view.concealmentServant.resources).toMatchObject({ maxSpirituality: 120, spirituality: s.spirituality });
    expectOriginalHistory(s, old); expect(s.spiritWarlock).toEqual(old.spiritWarlock);
    const promotion = concealmentServantBoundary('promotion');
    expect(promotion.final.spirituality).toBe(promotion.beforeLast.spirituality); expect(promotion.final.injuries).toEqual(promotion.beforeLast.injuries); expect(promotion.final.injuryRisk).toBe(promotion.beforeLast.injuryRisk);
    const outcome = promotion.final.concealmentServant.bottles.find(b => b.consumedWeek === promotion.final.concealmentServant.promotionWeek && ['SUCCESS', 'GREAT_SUCCESS'].includes(b.outcome ?? ''))!.outcome;
    expect(promotion.final.mind).toBe(promotion.beforeLast.mind - (outcome === 'GREAT_SUCCESS' ? 8 : 15));
  });
  it('keeps all seven old histories visible with saved100 acting while old current-stage work remains closed', () => {
    const s = concealmentServantSnapshot('promoted'), view = projectSliceState(s);
    for (const key of [...darknessLegacyKeys, 'spiritWarlock'] as const) {
      expect(view[key].promoted, key).toBe(true); expect(view[key].acting, key).toBe(100);
      expect(view[key].actions.filter(a => a.enabled && !['INVITE_SPIRIT', 'RELEASE_SPIRIT'].includes(a.command.type)), key).toEqual([]);
    }
    const intents: SliceIntent[] = [
      { type: 'SLEEPLESS', command: { type: 'SURVEY', watchId: 'quiet-warehouse' } },
      { type: 'MIDNIGHT', command: { type: 'OBSERVE', caseId: 'sleepless-patient' } },
      { type: 'NIGHTMARE', command: { type: 'OBSERVE', caseId: 'letter-at-window' } },
      { type: 'SOOTHER', command: { type: 'OBSERVE', caseId: 'restless-wolf' } },
      { type: 'SPIRIT_WARLOCK', command: { type: 'OBSERVE', caseId: 'listening-leaves' } },
      { type: 'NIGHTWATCHER', command: { type: 'OBSERVE', caseId: 'uneven-cart' } },
      { type: 'FEAR_BISHOP', command: { type: 'OBSERVE', caseId: 'contained-residue' } },
      { type: 'FEAR_BISHOP', command: { type: 'PREPARE_PROMOTION' } },
      { type: 'FEAR_BISHOP', command: { type: 'ENCOUNTER_TALK' } },
    ];
    for (const intent of intents) { const before = JSON.stringify(s); expect(() => applySliceIntent(s, intent)).toThrow(); expect(JSON.stringify(s)).toBe(before); }
  });
  it('keeps Alan and Bram actually dead, Kyle/Orin/Harlan surrendered, and original objects/consumed kit unchanged', () => {
    const s = concealmentServantSnapshot('final'), old = concealmentServantSnapshot('departureStart'); expectOriginalHistory(s, old);
    expect(s.combatHistory[0]!.consequence).toContain('凯尔仍然活着'); expect(s.combatHistory[12]!.consequence).toContain('阿兰进入死亡分支');
    expect(s.combatHistory[13]!.consequence).toContain('奥林仍然活着'); expect(s.combatHistory[20]!.consequence).toContain('真实死亡');
    expect(s.nightwatcher.encounter.enemy).toMatchObject({ id: 'NW4-BRAM', status: 'DEAD', health: 0, weaponLocation: 'YARD' });
    expect(s.fearBishop.encounter).toMatchObject({ targetId: 'FB3-HARLAN', status: 'RESOLVED', enemyStatus: 'SURRENDERED', enemyHealth: 50, enemyMind: 100, enemySpirituality: 44, weaponLocation: 'YARD' });
    expect(s.fearBishop.life.tomas).toMatchObject({ mind: 98, state: 'AWAKE', effectActive: false });
    expect(s.fearBishop.life.residue).toMatchObject({ id: 'FB3-RESIDUE-1', status: 'DISSOLVED' });
    expect(s.fearBishop.life.trace).toMatchObject({ id: 'FB3-TRACE-1', status: 'DISSOLVED' });
    expect(s.nightwatcher.ritual).toEqual(old.nightwatcher.ritual); expect(s.spiritWarlock.practice).toEqual(old.spiritWarlock.practice);
    expect(s.spiritWarlock.companion).toMatchObject({ source: 'SW5-LEAF-1', acquiredWeek: 45, invitedWeek: 53, releases: 1 });
    expect(s.town).toMatchObject({ clubLocation: 'SHOP', bandagesHeld: 0, bandagesUsed: 0 });
  });
  it('reports actual natural life outcomes from event evidence without equating success with use', () => {
    const s = concealmentServantSnapshot('practiced'), l = s.concealmentServant.life;
    expect(s.progression.acting).toBe(100); expect(l.reflected).toBe(true); expect(l.activeCase).toBeNull();
    expect(l).toMatchObject({ playerLocation: 'EXIT', erin: { location: 'EXIT', alive: true, health: 100, mind: 100 }, box: { owner: 'CS2-ERIN', location: 'START' }, room: { concealed: false, doorBlocked: false }, trace: { exists: true } });
    for (const caseId of CONCEALMENT_SERVANT_CASE_IDS) {
      const r = l.cases[caseId], a = r.attempts.at(-1)!;
      expect(r).toMatchObject({ status: 'RESOLVED', closes: 1, returned: true, contactOpen: false }); expect(r.attempts).toHaveLength(1);
      expect(a).toMatchObject({ closed: true, boxReturned: true, exited: true, inspected: true, spiritualitySpent: 11 });
      expect(a.concealment.attempts).toBe(1); expect(a.traceVeil.attempts).toBe(1);
      expect(a.concealment.effects).toBeLessThanOrEqual(a.concealment.successes); expect(a.traceVeil.effects).toBeLessThanOrEqual(a.traceVeil.successes);
    }
    expect(CONCEALMENT_SERVANT_CASE_IDS.map(id => { const a = l.cases[id].attempts[0]!; return [a.elapsedSeconds, a.playerTravelMetres, a.erinTravelMetres]; })).toEqual([[58, 16, 12], [33, 12, 12], [65, 16, 36]]);
    expect(CONCEALMENT_SERVANT_CASE_IDS.map(id => { const a = l.cases[id].attempts[0]!; return [a.concealment.tier, a.traceVeil.tier]; })).toEqual([['FAILURE', 'GREAT_SUCCESS'], ['SUCCESS', 'SUCCESS'], ['SUCCESS', 'FAILURE']]);
    expect(CONCEALMENT_SERVANT_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([8, 8]);
    const revoked = l.cases['withdrawn-consent'].attempts[0]!; expect(revoked.stoppedBy).toBe('ERIN'); expect([revoked.concealment.effects, revoked.traceVeil.effects]).toEqual([0, 0]);
    const blocked = l.cases['blocked-door'].attempts[0]!; expect(blocked).toMatchObject({ doorBlocked: true, releasedAfterBlock: true, doorUnbolted: true, erinTravelMetres: 36 });
    for (const [index, field] of ['concealment', 'traceVeil'].entries()) {
      const expected = CONCEALMENT_SERVANT_CASE_IDS.reduce((n, id) => n + (l.cases[id].attempts[0]![field as 'concealment' | 'traceVeil'].effects > 0 ? 8 : 0), 0);
      expect(s.progression.mastery[CONCEALMENT_SERVANT_ABILITY_IDS[index]!]).toBe(expected);
    }
    expect(l.trace.delayedSearches).toBe(CONCEALMENT_SERVANT_CASE_IDS.filter(id => l.cases[id].attempts[0]!.traceVeil.effects > 0).length);
    expect(l.trace.totalDelaySeconds).toBe(l.trace.delayedSearches * 20);
  });
  it('uses the actual old Harlan resolver wheels without changing any recorded prior combat result', () => {
    const old = migrateSliceState(readObjectEntry<unknown>(fearBishopFixturePath, 'combatStart')), before = JSON.stringify(old), combat = projectSliceState(old).combat!;
    expect(combat.enemyCountWheel).toEqual(FEAR_BISHOP_ENEMY_COUNT_WHEEL); const labels = ['有限暗矢：5S/75','有限护术：4S/减45','同一原棍：20×身体','有限专注：4S/抵抗本轮下一次睡恐压力','判断偏差：−22.5']; expect(combat.enemyAbilityWheel).toEqual(FEAR_BISHOP_ENEMY_ABILITY_WHEEL.map((entry,index)=>({...entry,label:labels[index]})));
    expect(combat.enemyCountWheel.map(x => x.weight)).toEqual([10, 15, 25, 25, 15, 10]);
    expect(combat.enemyAbilityWheel.map(x => [x.id, x.weight])).toEqual([['DARK_BOLT', 35], ['WARD', 25], ['BODY_STRIKE', 20], ['FOCUS', 15], ['ACCIDENT', 5]]);
    expect(JSON.stringify(old)).toBe(before);
  });
  it('keeps the S120 public, save and ordinary-rest cap without a promotion refill or hidden cap30 clamp', () => {
    const s = unitBudget(concealmentServantSnapshot('promoted')); s.spirituality = 119; assertValidSliceState(s);
    expect(projectSliceState(s).maxSpirituality).toBe(120);
    const next = applySliceIntent(s, { type: 'ACTION', action: 'REST' }); expect(next.spirituality).toBe(120); assertValidSliceState(next);
    const invalid = structuredClone(s); invalid.spirituality = 121; expect(() => assertValidSliceState(invalid)).toThrow();
  });
  it('rejects old-source/history corruption and new-stage shortcuts instead of silently repairing the save', () => {
    const s = concealmentServantSnapshot('practiced');
    const changes: ((t: SliceState) => void)[] = [
      t => { delete t.progression.mastery['darkness.s3.dark-dissolution']; },
      t => { t.progression.mastery['darkness.s1.unearned'] = 0; },
      t => { t.fearBishop.life.tomas.mind = 100; },
      t => { t.nightwatcher.encounter.enemy.health = 100; t.nightwatcher.encounter.enemy.status = 'RESISTING'; },
      t => { (t.spiritWarlock.companion as unknown as { source: string }).source = 'CS2-FREE-SPIRIT'; },
      t => { t.spiritWarlock.companion.deployments++; },
      t => { t.fearBishop.encounter.enemyHealth = 100; },
      t => { t.fearBishop.life.trace.status = 'PRESENT' as typeof t.fearBishop.life.trace.status; },
      t => { t.fearBishop.encounter.status = 'READY'; },
      t => { t.concealmentServant.fearBishopActingAtPromotion = 0; },
      t => { t.concealmentServant.life.reflected = false; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(() => assertValidSliceState(t)).toThrow(); }
  });
});
