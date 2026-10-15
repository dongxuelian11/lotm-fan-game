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
const from=(folder:string)=>projectSliceState(migrateSliceState(JSON.parse(readFileSync(`tests/fixtures/${folder}/natural.json`,'utf8')).final));
beforeEach(()=>{vi.spyOn(window,'scrollTo').mockImplementation(()=>{});});
afterEach(()=>{cleanup();delete window.sliceGame;vi.restoreAllMocks();});
it('opens actual S7 to S6 Door advancement from the dashboard guide',async()=>{
 const c=JSON.parse(readFileSync('tests/fixtures/recorder-v0830/natural.json','utf8'));await enter(projectSliceState(migrateSliceState(c.guidanceStart)));await userEvent.click(screen.getByRole('button',{name:'查看记录官晋升'}));
 expect(screen.getByRole('region',{name:'记录官成长下一步'})).toBeTruthy();expect(window.sliceGame!.submitIntent).not.toHaveBeenCalled();
});
it('loads actual S6 reports and opens current growth plus inherited Astrologer history',async()=>{
 await enter(from('recorder-v0830'));await userEvent.click(screen.getByRole('button',{name:/非凡成长/}));
 expect(screen.getByRole('region',{name:'记录官成长下一步'})).toBeTruthy();
 await userEvent.click(screen.getByRole('button',{name:'占星人经历'}));
 expect(screen.getByRole('region',{name:'占星人时期的经历'})).toBeTruthy();expect(window.sliceGame!.submitIntent).not.toHaveBeenCalled();
});
it.each([false,true])('uses one explicit original battle record, selected=%s',async selected=>{
 const c=JSON.parse(readFileSync('tests/fixtures/recorder-v0830/natural.json','utf8')),state=projectSliceState(migrateSliceState(c.combatStart));
 await enter(state);vi.mocked(window.sliceGame!.submitIntent).mockImplementation(()=>new Promise(()=>{}));
 const select=screen.getByRole('combobox',{name:'本回合原记录'}) as HTMLSelectElement;
 expect(select.value).toBe('');const stored=state.recorder.records.find(r=>r.status==='STORED')!;expect(stored).toBeTruthy();
 if(selected)await userEvent.selectOptions(select,stored.id);
 expect(screen.queryByRole('option',{name:new RegExp(state.recorder.records.find(r=>r.status==='RELEASED')!.id+'$')})).toBeNull();
 await userEvent.click(screen.getByRole('button',{name:'确认姿态，结算完整回合'}));
 expect(window.sliceGame!.submitIntent).toHaveBeenCalledTimes(1);
 expect(vi.mocked(window.sliceGame!.submitIntent).mock.calls[0]![0].payload).toEqual({type:'COMBAT_ROUND',stance:'ATTACK',recordingId:selected?stored.id:null});
});
