import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import { validateSlicePayload } from '../../src/domain/slice/validation';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types';
import { GLORY_ABILITY_IDS } from '../../src/domain/glory/types';
import { GLORY_ENEMY_ABILITY_WHEEL, GLORY_ENEMY_COUNT_WHEEL } from '../../src/domain/glory/combat';
const ROOT = 'tests/fixtures/glory-v01760';
const actual = JSON.parse(readFileSync(`${ROOT}/natural.json`, 'utf8')) as {
  provenance: string; continuation: { kind: string; fullNaturalS9ToS2: boolean; newRandomChanges: boolean };
  initial: SliceState; startingState: unknown; commands: SliceIntent[]; prefixCount: number;
  promoted: SliceState; practiced: SliceState; combatStart: SliceState; final: SliceState;
  treatments: { paidPennies: number; before: { health: number; injuries: { severity: string }[] }; healthAfter: number }[];
  sourcePreservation: { file: string; sha256: string }[];
};
const old = JSON.parse(readFileSync('tests/fixtures/silver-knight-v01520/directed.json', 'utf8')) as { startingState: unknown; commands: SliceIntent[]; final: unknown };
const LEGACY = ['warrior','gladiator','weaponmaster','dawnPaladin','guardian','demonHunter','silverKnight'] as const;
const snap = (key: 'promoted'|'practiced'|'combatStart'|'final') => migrateSliceState(actual[key]);
const index = JSON.parse(readFileSync(`${ROOT}/boundaries.index.json`, 'utf8')) as Record<string,string>;
function boundary(name: string) { return JSON.parse(readFileSync(`${ROOT}/${index[name]}`, 'utf8')) as {beforeLast:SliceState; lastIntent:SliceIntent; final:SliceState}; }

describe('Glory actual continuation and shared invariants', () => {
  it('replays all158 public commands from the unchanged original directed starting point', () => {
    expect(actual.startingState).toEqual(old.startingState); expect(actual.commands).toHaveLength(158); expect(actual.prefixCount).toBe(70);
    expect(actual.commands.slice(0,70)).toEqual(old.commands);
    const initialBytes=JSON.stringify(actual.initial);
    let state=migrateSliceState(actual.startingState);expect(state).toEqual(migrateSliceState(actual.initial));
    expect(JSON.stringify(actual.initial)).toBe(initialBytes);
    actual.commands.forEach((intent,i)=>{expect(validateSlicePayload(intent)).toBe(true);state=applySliceIntent(state,intent);if(i===69)expect(state).toEqual(migrateSliceState(old.final));});
    expect(state).toEqual(snap('final'));expect(state.random).toEqual({seed:'warrior-natural-v042',cursor:475});
  }, 60000);
  it('keeps the earlier directed provenance and all four original input byte hashes', () => {
    expect(actual.provenance).toMatch(/DIRECTED/); expect(actual.continuation).toMatchObject({kind:'DIRECTED_SILVER_KNIGHT_PREFIX_THEN_PUBLIC_GLORY',fullNaturalS9ToS2:false,newRandomChanges:false});
    expect(actual.sourcePreservation).toHaveLength(4);
    for(const source of actual.sourcePreservation)expect(createHash('sha256').update(readFileSync(source.file)).digest('hex')).toBe(source.sha256);
  });
  it.each(LEGACY)('preserves the complete original %s root after promotion, practice and combat', root => {
    const before=migrateSliceState(old.final); for(const key of ['promoted','practiced','final'] as const)expect(snap(key)[root]).toEqual(before[root]);
  });
  it('records actual paid treatment and later rest instead of silently healing original injuries', () => {
    const before=migrateSliceState(old.final); expect(before.health).toBe(30);expect(before.injuries.map(x=>x.severity)).toEqual(['HEAVY','HEAVY','LIGHT']);
    expect(actual.treatments).toHaveLength(1);expect(actual.treatments[0]!.paidPennies).toBe(60);expect(actual.treatments[0]!.healthAfter).toBe(actual.treatments[0]!.before.health);
    expect(snap('combatStart').injuries).toEqual([]);expect(snap('final').injuries.map(x=>x.severity)).toEqual(['LIGHT']);
  });
  it('adds exactly two zero mastery entries on first-dose promotion and awards only real applications', () => {
    const source=migrateSliceState(old.final), promoted=snap('promoted'), practiced=snap('practiced');
    expect(Object.keys(source.progression.mastery)).toHaveLength(18);expect(Object.keys(promoted.progression.mastery)).toHaveLength(20);
    for(const id of Object.keys(source.progression.mastery))expect(promoted.progression.mastery[id]).toBe(source.progression.mastery[id]);
    for(const id of GLORY_ABILITY_IDS){expect(promoted.progression.mastery[id]).toBe(0);expect(practiced.progression.mastery[id]).toBe(8);}
    expect(promoted.character.gender).toBe(source.character.gender);expect(promoted.glory.bottles[0]!.outcome).toBe('GREAT_SUCCESS');
  });
  it('carries the same original armor65 into actual60 while recording the real5H bridge burden', () => {
    const state=snap('final'),life=state.glory.life;
    expect(state.silverKnight.life.armor.integrity).toBe(65);expect(life.site.armorSource?.snapshot).toEqual(state.silverKnight.life.armor);
    expect(life.site.armor.id).toBe(state.silverKnight.life.armor.id);expect(life.site.armor.integrity).toBe(60);
    expect(life.site.guard.sharedHealth).toBe(5);expect(life.site.guard.sharedEnergy).toBe(5);expect(life.site.pads.consumed).toBe(1);
    expect(life.site.celia.location).toBe('OUTSIDE');expect(life.site.evan.location).toBe('OUTSIDE');expect(life.site.playerLocation).toBe('OUTSIDE');
  });
  it('projects the actual independent enemy wheels and preserves the original surrender/body costs', () => {
    const start=snap('combatStart'),p=projectSliceState(start);expect(p.combat?.enemyAbilityWheel).toEqual(GLORY_ENEMY_ABILITY_WHEEL);expect(p.combat?.enemyCountWheel).toEqual(GLORY_ENEMY_COUNT_WHEEL);
    const final=snap('final');expect(final.status).toBe('ACTIVE');expect(final.health).toBe(90);expect(final.glory.encounter.enemyStatus).toBe('SURRENDERED');expect(final.glory.encounter.enemyHealth).toBe(70);expect(final.glory.encounter.weaponLocation).toBe('YARD');
    expect(actual.commands.at(-1)).toEqual({type:'ACTION',action:'WORK'});
  });
  it('retains failed natural combat preparations instead of claiming the directed effects applied', () => {
    const rounds=snap('final').combatHistory.filter(r=>r.gloryOutcome);expect(rounds).toHaveLength(2);
    for(const r of rounds){expect(r.consequenceDomain).toBe('BODY');expect(r.gloryOutcome!.armorWear).toBe(0);expect(r.gloryOutcome!.healthPaid).toBe(0);}
    expect(rounds[0]!.consequenceRoll).toBe(19);expect(rounds[0]!.consequenceWeights).toEqual({light:65,heavy:30,death:5});
  });
  it.each(['snapshot-source','current-armor','promotion-entry','outcome-domain'] as const)('rejects %s tampering in the actual complete history', kind => {
    const s=snap('final');
    if(kind==='snapshot-source')s.glory.life.site.armorSource!.snapshot.integrity=100;
    if(kind==='current-armor')s.glory.life.site.armor.integrity=65;
    if(kind==='promotion-entry')s.glory.silverKnightActingAtPromotion=0;
    if(kind==='outcome-domain'){s.lastCombatRound!.consequenceDomain='MENTAL';s.combatHistory.at(-1)!.consequenceDomain='MENTAL';}
    expect(()=>assertValidSliceState(s)).toThrow();
  });
  it('reopens the actual terminal saved boundary without moving or copying the original opponent', () => {
    const b=boundary('combat-terminal');expect(applySliceIntent(migrateSliceState(b.beforeLast),b.lastIntent)).toEqual(migrateSliceState(b.final));
    expect(snap('final').glory.encounter.targetId).toBe('GL2-MARTIN');expect(snap('final').glory.encounter.enemyPosition).toBe('YARD');
  });
});
