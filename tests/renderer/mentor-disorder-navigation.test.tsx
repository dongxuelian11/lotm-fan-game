/* @vitest-environment jsdom */
import type { SliceBridge } from "../../src/shared/slice-contracts";
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {readFileSync} from 'node:fs';
import {SliceApp} from '../../src/renderer/SliceApp';
import {migrateSliceState} from '../../src/domain/slice/migration';
import {projectSliceState} from '../../src/domain/slice';
import type {SliceProjection} from '../../src/domain/slice/types';
async function enter(state:SliceProjection){
 window.sliceGame={getBootstrap:vi.fn<SliceBridge["getBootstrap"]>(async()=>({ok:true,value:{mode:'browser',activeState:state,runs:[{runId:state.runId,name:state.character.name,portraitId:state.character.portraitId,week:state.week,date:state.date,status:state.status,revision:state.revision,updatedAt:'2026-10-12T00:00:00Z'}]}})),loadRun:vi.fn<SliceBridge["loadRun"]>(async()=>({ok:true,value:state})),submitIntent:vi.fn()};
 render(<SliceApp/>);await userEvent.click(await screen.findByRole('button',{name:/继续游戏/}));await userEvent.click(screen.getByRole('button',{name:new RegExp(state.character.name)}));await screen.findByRole('heading',{name:'人物卷宗'});const reveal=screen.queryByRole('dialog',{name:'战斗回合结果'});if(reveal)await userEvent.click(within(reveal).getByRole('button',{name:state.combat?'进入下一回合':'返回生活'}));
}
const from=(folder:string)=>projectSliceState(migrateSliceState(JSON.parse(readFileSync(`tests/fixtures/${folder}/natural.json`,'utf8')).practiced));
beforeEach(()=>{vi.spyOn(window,'scrollTo').mockImplementation(()=>{});});
afterEach(()=>{cleanup();delete window.sliceGame;vi.restoreAllMocks();});
it('opens actual S6 to S5 BlackEmperor advancement through permanent growth while injury guidance retains priority',async()=>{
 const c=JSON.parse(readFileSync('tests/fixtures/mentor-disorder-v01140/natural.json','utf8')), before=structuredClone(c.guidanceStart);
 expect(c.guidanceStart.injuries.some((injury: { severity: string; treatedRevision: number | null })=>injury.severity==='HEAVY'&&injury.treatedRevision===null)).toBe(true);
 await enter(projectSliceState(migrateSliceState(c.guidanceStart)));expect(screen.getByRole('region',{name:'接下来'}).textContent).toContain('先处理仍在的伤势');
 await userEvent.click(screen.getByRole('button',{name:/非凡成长/}));await userEvent.click(screen.getByRole('button',{name:'混乱导师晋升'}));
 expect(c.guidanceStart).toEqual(before);
 expect(screen.getByRole('region',{name:'混乱导师成长下一步'})).toBeTruthy();expect(window.sliceGame!.submitIntent).not.toHaveBeenCalled();
});
it('loads actual peaceful S5 reports before the optional independent battle and opens inherited CorruptionBaron history',async()=>{
 await enter(from('mentor-disorder-v01140'));await userEvent.click(screen.getByRole('button',{name:/非凡成长/}));
 expect(screen.getByRole('region',{name:'混乱导师成长下一步'})).toBeTruthy();
 await userEvent.click(screen.getByRole('button',{name:'腐化男爵经历'}));
 expect(screen.getByRole('region',{name:'腐化男爵时期的经历'})).toBeTruthy();expect(window.sliceGame!.submitIntent).not.toHaveBeenCalled();
});


it('keeps all three earlier Black Emperor stages as actual read-only histories at S5',async()=>{
 await enter(from('mentor-disorder-v01140'));await userEvent.click(screen.getByRole('button',{name:/非凡成长/}));
 for(const name of ['贿赂者','野蛮人','律师']){await userEvent.click(screen.getByRole('button',{name:name+'经历'}));expect(screen.getByRole('region',{name:name+'时期的经历'})).toBeTruthy();}
 expect(window.sliceGame!.submitIntent).not.toHaveBeenCalled();
});
