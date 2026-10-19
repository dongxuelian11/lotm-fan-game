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
it('opens actual S6 to S5 Wheel advancement through permanent growth while the original injury retains priority',async()=>{
 const c=JSON.parse(readFileSync('tests/fixtures/winner-v01130/natural.json','utf8')), before=structuredClone(c.guidanceStart);
 expect(c.guidanceStart.injuries.some((injury: { severity: string; treatedRevision: number | null })=>injury.severity==='LIGHT'&&injury.treatedRevision===null)).toBe(true);
 await enter(projectSliceState(migrateSliceState(c.guidanceStart)));expect(screen.getByRole('region',{name:'接下来'}).textContent).toContain('先查看伤势恢复路线');
 await userEvent.click(screen.getByRole('button',{name:/非凡成长/}));await userEvent.click(screen.getByRole('button',{name:'赢家晋升'}));
 expect(c.guidanceStart).toEqual(before);
 expect(screen.getByRole('region',{name:'赢家成长下一步'})).toBeTruthy();expect(window.sliceGame!.submitIntent).not.toHaveBeenCalled();
});
it('loads actual peaceful S5 reports before the optional independent battle and opens inherited CalamityPriest history',async()=>{
 await enter(from('winner-v01130'));await userEvent.click(screen.getByRole('button',{name:/非凡成长/}));
 expect(screen.getByRole('region',{name:'赢家成长下一步'})).toBeTruthy();
 await userEvent.click(screen.getByRole('button',{name:'灾祸教士经历'}));
 expect(screen.getByRole('region',{name:'灾祸教士时期的经历'})).toBeTruthy();expect(window.sliceGame!.submitIntent).not.toHaveBeenCalled();
});


it.each(['HOLD','SPEND_FIRST'] as const)('sends exact %s reserve policy without spending before round confirmation',async policy=>{
 const c=JSON.parse(readFileSync('tests/fixtures/winner-v01130/natural.json','utf8'));await enter(projectSliceState(migrateSliceState(c.combatStart)));
 expect((screen.getByRole('radio',{name:'本回合保留幸运'}) as HTMLInputElement).checked).toBe(true);
 if(policy==='SPEND_FIRST')await userEvent.click(screen.getByRole('radio',{name:'首次合格防护或厄运时使用1份'}));
 expect(window.sliceGame!.submitIntent).not.toHaveBeenCalled();window.sliceGame!.submitIntent=vi.fn(()=>new Promise<Awaited<ReturnType<SliceBridge["submitIntent"]>>>(()=>{}));
 await userEvent.click(screen.getByRole('button',{name:'确认姿态，结算完整回合'}));
 expect(vi.mocked(window.sliceGame!.submitIntent).mock.calls[0]![0].payload).toMatchObject({type:'COMBAT_ROUND',winnerPolicy:policy});expect(window.sliceGame!.submitIntent).toHaveBeenCalledTimes(1);
});
