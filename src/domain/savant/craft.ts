import type {SliceState} from '../slice/types.js';
import type {SeerContext} from '../seer/index.js';
import type {SavantAction,SavantCommand,SavantCraftCommand} from './types.js';
import {SAVANT_PROJECTS} from './content.js';
export const isSavantCraft=(c:SavantCommand):c is SavantCraftCommand=>['STUDY','PREPARE','CRAFT','DELIVER','RETURN_TOOLS','REFLECT'].includes(c.type);
function blocked(s:SliceState,c:SavantCraftCommand):string|null{
 if(s.status!=='ACTIVE')return '当前周目已结束。';
 if(s.progression.pathwayId!=='paragon'||s.progression.sequence!==9)return '成为通识者后再开始工坊实践。';
 if(s.world.city!=='BACKLUND')return '需要本人回到贝克兰德工坊。';
 if(s.activeEvent||s.combat)return '先处理当前事件或战斗。';
 if(s.health<=0||s.mind<=0)return '先休养恢复身体与精神。';
 if(['STUDY','CRAFT','REFLECT'].includes(c.type)&&s.actionsRemaining<1)return '需要1行动。';
 if(c.type==='REFLECT')return s.savant.reflected?'已经整理过这段实践。':SAVANT_PROJECTS.some(x=>s.savant.projects[x.id]?.status!=='DELIVERED')?'先完成四项实际交付。':null;
 const r=s.savant.projects[c.projectId];if(!r||!SAVANT_PROJECTS.some(x=>x.id===c.projectId))return '未知的工坊委托。';
 if(c.type==='RETURN_TOOLS')return r.tool==='PLAYER'?null:'原工具已经在工坊。';
 if(r.status==='DELIVERED')return '原委托已交付，不重复领取报酬。';
 if(c.type==='STUDY')return r.status==='UNREAD'?null:'已经读过本项原图纸。';
 if(c.type==='PREPARE')return r.status!=='LEARNED'?'先学习本项图纸，或交付已经完成的作品。':r.tool==='PLAYER'?'已借到本项原工具。':Object.values(s.savant.projects).some(p=>p.tool==='PLAYER')?'先归还另一项原工具，再借本项工具。':r.materials==='SUPPLIER'&&s.cash<20?'本项材料需20便士。':null;
 if(c.type==='DELIVER')return r.status==='READY'?null:'先实际完成并检验作品。';
 return r.status!=='LEARNED'?'先学习本项图纸。':r.materials!=='WORKBENCH'||r.tool!=='PLAYER'?'先备齐本项原材料和借用工具。':r.attemptWeek===s.week?'本周试作未通过检验，保留材料，下周再练。':null;
}
export function applySavantCraft(s:SliceState,c:SavantCraftCommand,ctx:SeerContext,award:(source:string,amount:5|8|25)=>void){
 const reason=blocked(s,c);if(reason)throw new Error(reason);
 if(['STUDY','CRAFT','REFLECT'].includes(c.type))s.actionsRemaining--;
 if(c.type==='REFLECT'){s.savant.reflected=true;s.seer.completedSources.push('savant-reflection');s.progression.acting=Math.min(100,s.progression.acting+20);ctx.note('记住、理解与做出来','你对照四份图纸与实际成品，把测量、装配和检验中的差异记下来。记忆提供起点，材料与实践使知识成为真实结果。扮演+20。');return;}
 const spec=SAVANT_PROJECTS.find(x=>x.id===c.projectId)!,r=s.savant.projects[c.projectId]!;
 if(c.type==='STUDY'){r.status='LEARNED';ctx.note(spec.title,`你实际阅读工坊提供的图纸并听取说明：${spec.plan} 这份记忆只涉及本项普通结构，不揭示未知机械或非凡秘密。`);return;}
 if(c.type==='PREPARE'){if(r.materials==='SUPPLIER'){s.cash-=20;r.materials='WORKBENCH';}r.tool='PLAYER';ctx.note('备齐原材料与借用工具',`${spec.materials}留在本项工作台；你借到${spec.tool}，所有权仍属工坊。已经购得的材料不会因归还工具重复收费。`);return;}
 if(c.type==='RETURN_TOOLS'){r.tool='WORKSHOP';ctx.note('原工具已归还',`${spec.tool}交回工坊。未完材料或已完成作品仍在原工作台，之后可继续。`);return;}
 if(c.type==='CRAFT'){r.attemptWeek=s.week;const check=ctx.check('knowledge',12);if(check.tier==='SUCCESS'||check.tier==='GREAT_SUCCESS'){r.status='READY';r.materials='CONSUMED';ctx.note(spec.title,`${spec.plan} 检验通过，所列材料已实际用于修理或成品，等待本人交付；原借用工具仍需归还。`);}else ctx.note(spec.title,'试装与测量尚未通过检验。你在切削固定前停下，没有捏造完成品；原材料和工具留存，下周可以继续。');return;}
 r.status='DELIVERED';r.tool='WORKSHOP';s.cash+=24;s.progression.acting=Math.min(100,s.progression.acting+20);award(`savant-project:${c.projectId}`,8);ctx.note(spec.title,'委托人当面检验并领取自己的修复件或定制成品，原工具交回工坊。收到24便士工钱，扮演+20、单项掌握+8；不重复交付。');
}
export function savantProjects(s:SliceState){if(s.progression.pathwayId!=='paragon')return [];return SAVANT_PROJECTS.map(spec=>{const r=s.savant.projects[spec.id]!;return{id:spec.id,title:spec.title,story:spec.story,plan:r.status==='UNREAD'?'':spec.plan,status:r.status,materials:r.materials==='SUPPLIER'?`${spec.materials}：尚未取得`:r.materials==='WORKBENCH'?`${spec.materials}：留在本项工作台`:`${spec.materials}：已用于本项成品`,tool:`${spec.tool}：${r.tool==='PLAYER'?'本人借用，仍归工坊':'在工坊保管'}`};});}
export function savantCraftActions(s:SliceState):SavantAction[]{if(s.progression.pathwayId!=='paragon')return [];const out:SavantAction[]=[];const add=(label:string,cost:string,command:SavantCraftCommand)=>{const reason=blocked(s,command);out.push({id:`savant-${command.type}-${'projectId'in command?command.projectId:'reflection'}`,label,cost,command,enabled:reason===null,reason});};
 for(const spec of SAVANT_PROJECTS){const r=s.savant.projects[spec.id]!;if(r.status==='UNREAD')add('学习原图纸与操作说明','1行动',{type:'STUDY',projectId:spec.id});if(r.status==='LEARNED'){if(r.tool==='WORKSHOP')add('准备材料并借工具',r.materials==='SUPPLIER'?'0行动 · 20便士':'0行动 · 原材料已在工作台',{type:'PREPARE',projectId:spec.id});else add('实际试作并检验','1行动 · 知识难度12',{type:'CRAFT',projectId:spec.id});}if(r.status==='READY')add('当面交付并归还工具','0行动 · 工钱24便士',{type:'DELIVER',projectId:spec.id});if(r.tool==='PLAYER')add('暂时归还原工具','0行动 · 保留工作台材料或成品',{type:'RETURN_TOOLS',projectId:spec.id});}
 if(!s.savant.reflected)add('整理四项实际制作经验','1行动 · 四项交付后扮演+20',{type:'REFLECT'});return out;}
export function validateSavantCraft(s:SliceState){let held=0;for(const spec of SAVANT_PROJECTS){const r=s.savant.projects[spec.id];if(!r)return false;if(r.tool==='PLAYER')held++;if(r.status==='UNREAD'&&(r.materials!=='SUPPLIER'||r.tool!=='WORKSHOP'||r.attemptWeek!==null))return false;if(r.status==='LEARNED'&&r.materials==='CONSUMED')return false;if((r.status==='READY'||r.status==='DELIVERED')&&(r.materials!=='CONSUMED'||r.attemptWeek===null))return false;if(r.status==='DELIVERED'&&r.tool!=='WORKSHOP')return false;if(r.tool==='PLAYER'&&r.materials==='SUPPLIER')return false;if((r.status==='DELIVERED')!==s.seer.completedSources.includes(`savant-project:${spec.id}`))return false;}return held<=1&&s.savant.reflected===s.seer.completedSources.includes('savant-reflection')&&(!s.savant.reflected||Object.values(s.savant.projects).every(r=>r.status==='DELIVERED'));}
