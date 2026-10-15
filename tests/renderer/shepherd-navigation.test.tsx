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
it('opens actual S6 to S5 HangedMan advancement from the dashboard guide',async()=>{
 const c=JSON.parse(readFileSync('tests/fixtures/shepherd-v01100/natural.json','utf8'));await enter(projectSliceState(migrateSliceState(c.guidanceStart)));await userEvent.click(screen.getByRole('button',{name:'查看牧羊人晋升'}));
 expect(screen.getByRole('region',{name:'牧羊人成长下一步'})).toBeTruthy();expect(window.sliceGame!.submitIntent).not.toHaveBeenCalled();
});
it('loads actual peaceful S5 reports before the optional independent battle and opens inherited RoseBishop history',async()=>{
 await enter(from('shepherd-v01100'));await userEvent.click(screen.getByRole('button',{name:/非凡成长/}));
 expect(screen.getByRole('region',{name:'牧羊人成长下一步'})).toBeTruthy();
 await userEvent.click(screen.getByRole('button',{name:'蔷薇主教经历'}));
 expect(screen.getByRole('region',{name:'蔷薇主教时期的经历'})).toBeTruthy();expect(window.sliceGame!.submitIntent).not.toHaveBeenCalled();
});

it('sends the exact current owned-soul selection with the real battle round',async()=>{
 const c=JSON.parse(readFileSync('tests/fixtures/shepherd-v01100/natural.json','utf8'));await enter(projectSliceState(migrateSliceState(c.combatStart)));
 const selector=await screen.findByRole('combobox',{name:'本回合驱使的原灵'});expect(within(selector).queryByRole('option',{name:/塞德里克/})).toBeNull();
 await userEvent.selectOptions(selector,'SH5-IRIS-1');
 window.sliceGame!.submitIntent=vi.fn(()=>new Promise<Awaited<ReturnType<SliceBridge["submitIntent"]>>>(()=>{}));
 await userEvent.click(screen.getByRole('button',{name:'确认姿态，结算完整回合'}));
 const args=vi.mocked(window.sliceGame!.submitIntent).mock.calls[0]![0];
 expect(args.payload).toMatchObject({type:'COMBAT_ROUND',shepherdSpiritId:'SH5-IRIS-1'});expect(window.sliceGame!.submitIntent).toHaveBeenCalledTimes(1);
});
