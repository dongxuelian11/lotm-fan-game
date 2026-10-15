import { playerAbilityWheel } from '../../src/domain/slice/combat.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import {
  createWisdomAngelEncounterState, blockWisdomAngelEncounter, projectWisdomAngelEncounter,
  validateWisdomAngelEncounterCommand, validateWisdomAngelEncounter, hasWisdomAngelDisputeOpponent,
  hasWisdomAngelEncounterLock, settleWisdomAngelEncounter, applyWisdomAngelEncounterCommand,
} from '../../src/domain/wisdom-angel/encounter.js';
import { currentWisdomAngelCombatSource } from '../../src/domain/wisdom-angel/combat.js';
import { INSIGHT_SCHOLAR_COUNT_WHEEL, INSIGHT_SCHOLAR_ENEMY_COUNT_WHEEL, INSIGHT_SCHOLAR_ENEMY_ABILITY_WHEEL } from '../../src/domain/insight-scholar/combat.js';
import { wisdomAngelSnapshot, wisdomAngelBoundaryForIntent, wa, rejectWa, insightScholarDeathFixturePath } from './wisdom-angel-helper.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const noContext: SeerContext = { note: () => {}, roll: () => { throw new Error('Unexpected encounter draw'); }, check: () => { throw new Error('Unexpected encounter check'); } };
const approachBoundary = () => wisdomAngelBoundaryForIntent(i => i.type === 'WISDOM_ANGEL' && i.command.type === 'ENCOUNTER_TALK');
const fightBoundary = () => wisdomAngelBoundaryForIntent(i => i.type === 'WISDOM_ANGEL' && i.command.type === 'ENCOUNTER_FIGHT');
let approach: SliceState, ready: SliceState, fighting: SliceState;
beforeAll(() => { approach = approachBoundary().beforeLast; ready = fightBoundary().beforeLast; fighting = wisdomAngelSnapshot('combatStart'); });
const oldRoots = ['reader', 'reasoner', 'detective', 'polymath', 'mysticismMagister', 'prophet', 'insightScholar'] as const;

describe('Wisdom Angel original Victor, explicit conflict and ordinary2metre exit', () => {
  it('introduces one original49-year-old G2 person with an independent body,120S and his sole original club', () => {
    const initial = createWisdomAngelEncounterState(); expect(approach.wisdomAngel.encounter).toEqual(initial);
    expect(initial).toMatchObject({ targetId: 'WA2-VICTOR', status: 'AVAILABLE', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120,
      enemyStatus: 'RESISTING', weaponLocation: 'HAND', powerUses: { FLASH: 0, WARD: 0, FEINT: 0 }, conditionVersion: 1, observations: [], responseWindow: null,
      room: { id: 'WA2-COURT', doorId: 'WA2-COURT-DOOR', doorStatus: 'OPEN' }, playerLocation: 'OUTSIDE', playerTravelMetres: 0, clockSeconds: 0 });
    expect(projectWisdomAngelEncounter(approach).enemy).toMatchObject({ id: 'WA2-VICTOR', name: '维克托', age: 49, sequence: 2,
      source: 'ORIGINAL_OPEN_COURT_ADULT', weaponId: 'WA2-VICTOR-CLUB', health: 100, mind: 100, spirituality: 120 });
    expect(approach.insightScholar.encounter).toMatchObject({ targetId: 'IS3-ALTON', status: 'RESOLVED', enemyHealth: 100, enemyStatus: 'RESISTING' });
    for (const key of oldRoots) expect(approach[key]).toEqual(fighting[key]);
    expect(JSON.stringify(approach.prophet.encounter)).toContain('PF4-HAROLD');
  });
  it('replays the separately chosen1AP approach and1AP fight with physical movement and no RNG or automatic capability use', () => {
    const a = approachBoundary(), f = fightBoundary(), frozen = structuredClone(a.beforeLast);
    const talked = applySliceIntent(a.beforeLast, a.lastIntent); expect(a.beforeLast).toEqual(frozen); expect(talked).toEqual(a.final); expect(talked).toEqual(f.beforeLast);
    expect(talked.actionsRemaining).toBe(a.beforeLast.actionsRemaining - 1); expect(talked.combat).toBeNull(); expect(hasWisdomAngelEncounterLock(talked)).toBe(true);
    expect(talked.wisdomAngel.encounter).toMatchObject({ status: 'READY', playerLocation: 'DOORSTEP', playerTravelMetres: 2, clockSeconds: 2 });
    const next = applySliceIntent(talked, f.lastIntent); expect(next).toEqual(f.final); expect(next).toEqual(fighting); expect(next.actionsRemaining).toBe(talked.actionsRemaining - 1);
    expect(next.random).toEqual(a.beforeLast.random); expect(next.spirituality).toBe(a.beforeLast.spirituality); expect(next.injuries).toEqual(a.beforeLast.injuries);
    expect(next.wisdomAngel.encounter.observations).toEqual([]); expect(next.wisdomAngel.encounter.conditionVersion).toBe(1);
    expect(next.wisdomAngel.encounter.abilityUses).toEqual(createWisdomAngelEncounterState().abilityUses);
    expect(hasWisdomAngelDisputeOpponent(next)).toBe(true); expect(validateWisdomAngelEncounter(next)).toBe(true); assertValidSliceState(next);
    for (const key of oldRoots) expect(next[key]).toEqual(a.beforeLast[key]);
  });
  it('requires actual talk and two available actions before approaching rather than silently deciding to fight', () => {
    rejectWa(approach, { type: 'ENCOUNTER_FIGHT' }); rejectWa(approach, { type: 'LEAVE_ENCOUNTER' });
    const s = structuredClone(approach); s.actionsRemaining = 1;
    expect(blockWisdomAngelEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('另留'); rejectWa(s, { type: 'ENCOUNTER_TALK' });
  });
  it('takes the separate public peaceful branch with actual2metres/2seconds, no enemy refill and no combat reward', () => {
    const before = structuredClone(ready), next = wa(ready, { type: 'LEAVE_ENCOUNTER' });
    expect(next.wisdomAngel.encounter).toMatchObject({ status: 'RESOLVED', terminal: null, startHistoryIndex: null, playerLocation: 'OUTSIDE', playerTravelMetres: 4, clockSeconds: 4,
      enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', weaponLocation: 'HAND', observations: [], conditionVersion: 1 });
    for (const key of ['health', 'mind', 'spirituality', 'cash', 'week', 'actionsRemaining', 'injuryRisk', 'injuries', 'progression', 'town', 'random', 'combatHistory', ...oldRoots] as const) expect(next[key]).toEqual(before[key]);
    expect(next.wisdomAngel.life).toEqual(before.wisdomAngel.life); expect(hasWisdomAngelEncounterLock(next)).toBe(false); expect(next.combat).toBeNull();
    rejectWa(next, { type: 'ENCOUNTER_TALK' }); rejectWa(next, { type: 'ENCOUNTER_FIGHT' });
  });
  it('zeroAP and zero mind do not block the already-open physical return; no ability or hidden restoration is needed', () => {
    // Isolated encounter API, before shared ordinary week-end bookkeeping.
    const state = structuredClone(ready); state.actionsRemaining = 0; state.mind = 0; const before = structuredClone(state);
    expect(blockWisdomAngelEncounter(state, { type: 'LEAVE_ENCOUNTER' })).toBeNull();
    applyWisdomAngelEncounterCommand(state, { type: 'LEAVE_ENCOUNTER' }, noContext);
    expect(state.wisdomAngel.encounter.playerLocation).toBe('OUTSIDE'); expect(state.wisdomAngel.encounter.playerTravelMetres).toBe(before.wisdomAngel.encounter.playerTravelMetres + 2);
    expect(state.wisdomAngel.encounter.clockSeconds).toBe(before.wisdomAngel.encounter.clockSeconds + 2);
    expect(state.actionsRemaining).toBe(0); expect(state.mind).toBe(0); expect(state.spirituality).toBe(before.spirituality); expect(state.random).toEqual(before.random);
    expect(state.progression).toEqual(before.progression); expect(state.injuries).toEqual(before.injuries);
  });
  it('does not expose Victor or future facts before actualS2 promotion', () => {
    const state = wisdomAngelSnapshot('guidanceStart'), p = projectWisdomAngelEncounter(state);
    expect(state.progression.sequence).toBe(3); expect(p.enemy).toBeNull(); expect(p.room).toBeNull(); expect(p.actions).toEqual([]); expect(p.facts).toEqual([]); expect(p.story).toBe('');
    expect(JSON.stringify(p)).not.toMatch(/WA2-VICTOR|维克托|WA2-COURT/); expect(currentWisdomAngelCombatSource(state)).toBeNull();
  });
  it.each([null, [], {}, { type: 'ENCOUNTER_FIGHT', targetId: 'IS3-ALTON' }, { type: 'LEAVE_ENCOUNTER', teleport: true }, { type: 'ENCOUNTER_TALK', extra: null }, { type: 'REFILL_ENEMY' }])(
    'rejects malformed encounter command%j without mutation', command => { expect(validateWisdomAngelEncounterCommand(command)).toBe(false); rejectWa(approach, command); });
  it.each(['door', 'location', 'dead', 'foreign-stage', 'old-preparation', 'current-preparation', 'old-fight', 'borrowed-original'] as const)(
    'blocks isolated%s source mismatch before charging or drawing', kind => {
      const state = structuredClone(ready);
      if (kind === 'door') state.wisdomAngel.encounter.room.doorStatus = 'BLOCKED' as never;
      if (kind === 'location') state.world.city = 'ELSEWHERE';
      if (kind === 'dead') { state.status = 'DEAD'; state.health = 0; }
      if (kind === 'foreign-stage') state.progression.sequence = 3;
      if (kind === 'old-preparation') state.insightScholar.preparedWeek = state.week;
      if (kind === 'current-preparation') state.wisdomAngel.preparedWeek = state.week;
      if (kind === 'old-fight') state.insightScholar.encounter.status = 'FIGHTING';
      if (kind === 'borrowed-original') state.mysticismMagister.practice.token = 'PLAYER';
      expect(blockWisdomAngelEncounter(state, { type: 'ENCOUNTER_FIGHT' })).not.toBeNull(); rejectWa(state, { type: 'ENCOUNTER_FIGHT' });
    });
  it('cannot use knowledge to leave through a fabricated blocked original door', () => {
    const state = structuredClone(ready); state.wisdomAngel.encounter.room.doorStatus = 'BLOCKED' as never;
    expect(blockWisdomAngelEncounter(state, { type: 'LEAVE_ENCOUNTER' })).toContain('原门受阻'); rejectWa(state, { type: 'LEAVE_ENCOUNTER' });
    expect(validateWisdomAngelEncounter(state)).toBe(false);
  });
  it('cannot bypass real combat with peaceful leave, repeat approach or restart', () => {
    for (const type of ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'] as const) rejectWa(fighting, { type });
    expect(currentWisdomAngelCombatSource(fighting)).not.toBeNull();
  });
  it('refuses fabricated terminal settlement until a real saved public-wheel round and the original source agree', () => {
    for (const outcome of ['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED']) {
      const state = structuredClone(fighting), before = structuredClone(state);
      expect(() => settleWisdomAngelEncounter(state, outcome, noContext)).toThrow(); expect(state).toEqual(before);
    }
  });
  it('the actual captured terminal cannot reopen or refill the same original opponent', () => {
    const state = wisdomAngelBoundaryForIntent(i => i.type === 'COMBAT_ROUND', b => b.final.wisdomAngel.encounter.terminal !== null).final;
    expect(validateWisdomAngelEncounter(state)).toBe(true);
    for (const type of ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'] as const) rejectWa(state, { type });
    expect(() => applySliceIntent(state, { type: 'COMBAT_ROUND', stance: 'RETREAT' })).toThrow(); expect(currentWisdomAngelCombatSource(state)).toBeNull();
  });
  it('repairs inherited Insight Scholar public wheels against their actual source constants without modifying old RNG, outcome or history', () => {
    const old = migrateSliceState(readObjectEntry<unknown>(insightScholarDeathFixturePath, 'combatStart')), before = structuredClone(old), p = projectSliceState(old).combat!;
    expect(p.playerCountWheel).toEqual(INSIGHT_SCHOLAR_COUNT_WHEEL); expect(p.enemyCountWheel).toEqual(INSIGHT_SCHOLAR_ENEMY_COUNT_WHEEL);
    const enemyLabels=["有限闪光：5S/75", "有限护术：4S/减45", "同一原棍：20×身体", "有限专注：4S/抵本轮下一次成功闪光或方法压力", "判断偏差：−22.5"],playerLabels=["持握原短棍打击", "有限方法辨析（J；仅本场已亲见FLASH/WARD，5S/知识18减35；未见普通避让10/0S）", "继承片段预警（B；4S/意志16减22，不预读未来）", "继承原FLASH（K；实际已学，2S/知识14，减12×旧掌握）", "实际耗用最早原微光片（R；0S，减18×制作固定效力）", "判断失衡（A；固定−22.5）"];
    expect(INSIGHT_SCHOLAR_ENEMY_ABILITY_WHEEL).toHaveLength(enemyLabels.length);expect(p.playerAbilityWheel).toHaveLength(playerLabels.length);expect(old.town.clubLocation).toBe('HAND');
    expect(p.enemyAbilityWheel).toEqual(INSIGHT_SCHOLAR_ENEMY_ABILITY_WHEEL.map((entry,index)=>({...entry,label:enemyLabels[index]})));
    expect(p.playerAbilityWheel).toEqual(playerAbilityWheel(old,null).map((entry,index)=>({...entry,label:playerLabels[index]})));
    for(const stance of ['ATTACK','DEFEND','CONTROL','PREPARE'] as const)expect(p.playerAbilityWheels?.[stance]).toEqual(playerAbilityWheel(old,stance).map((entry,index)=>({...entry,label:playerLabels[index]})));
    expect(p.playerAbilityWheels?.RETREAT).toEqual([]);
    expect(p.enemyAbilityWheel.map(a => [a.id, a.weight])).toEqual([['FLASH', 35], ['WARD', 25], ['BODY_STRIKE', 20], ['FOCUS', 15], ['ACCIDENT', 5]]);
    expect(old).toEqual(before); assertValidSliceState(old);
  });
});
