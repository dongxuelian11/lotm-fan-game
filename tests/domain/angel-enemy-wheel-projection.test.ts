import {describe,it,expect} from 'vitest';
import {readObjectEntry} from '../helpers/read-object-entry.js';
import {projectSliceState,assertValidSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import {WAR_BISHOP_ENEMY_COUNT_WHEEL,WAR_BISHOP_ENEMY_ABILITY_WHEEL} from '../../src/domain/war-bishop/combat.js';
import {MIRACLE_WORKER_ENEMY_COUNT_WHEEL,MIRACLE_WORKER_ENEMY_ABILITY_WHEEL} from '../../src/domain/miracle-worker/combat.js';
import {WEATHER_WARLOCK_ENEMY_COUNT_WHEEL,WEATHER_WARLOCK_ENEMY_ABILITY_WHEEL} from '../../src/domain/weather-warlock/combat.js';
describe('actual named enemy public wheels match their unchanged resolver sources',()=>{
 it.each([
  ['war-bishop-v01410/natural','WAR_BISHOP_DISPUTE',WAR_BISHOP_ENEMY_COUNT_WHEEL,WAR_BISHOP_ENEMY_ABILITY_WHEEL,["原有限弧光术：5灵性、贡献75", "原有限护术：4灵性、减势45", "自有原棍：20×身体", "普通整理持棍姿势：0贡献", "动作偏差：−22.5"]],
  ['miracle-worker-v01640/continuation','MIRACLE_WORKER_DISPUTE',MIRACLE_WORKER_ENEMY_COUNT_WHEEL,MIRACLE_WORKER_ENEMY_ABILITY_WHEEL,["原灰弧术：6灵性/贡献85", "原有限护术：5灵性/减势50", "自有原棍：22×身体", "普通整理姿势：0贡献", "动作偏差：−22.5"]],
  ['weather-warlock-v01650/natural','WEATHER_WARLOCK_DISPUTE',WEATHER_WARLOCK_ENEMY_COUNT_WHEEL,WEATHER_WARLOCK_ENEMY_ABILITY_WHEEL,["原有限雷光术：8灵性、贡献95", "原有限风屏：6灵性、减势55", "自有原棍：20×身体", "普通整理持棍姿势：0贡献", "动作偏差：−22.5"]],
 ] as const)('uses the actual %s enemy source, with no ordinary fallback or state mutation',(file,encounter,counts,abilities,displayLabels)=>{
  const s=migrateSliceState(readObjectEntry(`tests/fixtures/${file}.json`,'combatStart'));assertValidSliceState(s);
  const before=JSON.stringify(s),sourceBefore=JSON.stringify({counts,abilities}),p=projectSliceState(s);expect(s.combat?.encounterId).toBe(encounter);
  expect(p.combat?.enemyCountWheel).toEqual(counts);expect(p.combat?.enemyCountWheel).toHaveLength(6);
  // Compare every source ID and weight, with independently pinned player-facing labels and costs.
  expect(abilities).toHaveLength(displayLabels.length);
  expect(p.combat?.enemyAbilityWheel).toEqual(abilities.map((entry,index)=>({...entry,label:displayLabels[index]})));
  expect(abilities.reduce((n,a)=>n+a.weight,0)).toBe(100);
  expect(JSON.stringify(s)).toBe(before);expect(JSON.stringify({counts,abilities})).toBe(sourceBefore);
 });
});
