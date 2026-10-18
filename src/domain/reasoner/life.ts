import type {SliceState} from '../slice/types.js';
import type {SeerContext} from '../seer/index.js';
import type {ReasonerCommand,ReasonerActivityCommand,ReasonerAction,ReasonerProjection} from './types.js';
type Test={id:string;label:string;result:string;conclusion:string};
type Case={id:string;title:string;story:string;observations:string[];hypotheses:string[];tests:Test[];conclusions:{id:string;label:string}[]};
const CASES:Case[]=[
 {id:'stair-footprints',title:'楼梯上的第二道泥印',story:'画框店主黛娜请你检查后楼梯。她只授权查看公共台阶、当天送货记录，并询问愿意配合的搬运工；屋内租客的房间不在调查范围。',observations:['两道泥印叠在第三级台阶，较新一层覆盖已干的浅印。','送货单写上午十点，楼梯没有持续看守；泥印不带人的姓名。'],hypotheses:['搬运工送货时留下了后一道印。','后来经过的人穿着相似靴子。'],tests:[{id:'BOOT_SAMPLE',label:'征得同意，比对搬运工靴底',result:'搬运工自愿在废纸上留下靴印。钉位与后一道泥印相似，但这是常见修补方式；不能排除别人穿着相似靴子。',conclusion:'POSSIBLE_WORKER'},{id:'TIMING_LEDGER',label:'核实送货后实际清扫顺序',result:'你与店主核对当天值勤单，清扫员确认送货离开后才擦过第三级台阶；新泥印叠在那道擦痕之上。可以判断新印晚于该次送货，仍不知道留下它的人。',conclusion:'AFTER_DELIVERY'}],conclusions:[{id:'AFTER_DELIVERY',label:'后一道印在本次送货以后形成，身份未明'},{id:'POSSIBLE_WORKER',label:'靴底相似，只能保留搬运工这一可能'},{id:'ACCUSE',label:'认定搬运工闯入了租客房间'}]},
 {id:'swapped-invoice',title:'账单上多出来的一个零',story:'装订铺的诺兰拿来一份抄账，请你核查一项价格。原订货人仍有权拒绝透露私事；本次不需要查他的其他交易。',observations:['抄账写单价120，三件总价36。','本次原装订编号与订货日期齐全，抄账本身没有客户签字。'],hypotheses:['抄写单价时多写一个零。','数量或总价抄错。','另有折扣约定，但目前没有凭据。'],tests:[{id:'COUNTERFOIL',label:'请铺主取出本次签字存根核对',result:'铺主拿出同编号签字存根：单价12、数量3、总价36，改价栏为空。三处相互符合；此次抄账的单价多了一个零。你没有改动或带走原存根。',conclusion:'COPY_ERROR'},{id:'CLIENT_CONFIRM',label:'当面向订货人求证口头折扣',result:'订货人愿意确认确有这笔订货，但不愿在本次会面透露价格或折扣。你尊重拒绝，现有矛盾尚不能据此解决，不能把拒绝视为欺诈证据。',conclusion:'UNRESOLVED'}],conclusions:[{id:'COPY_ERROR',label:'以同编号存根确认此次抄账单价写错'},{id:'UNRESOLVED',label:'这次核实未解决价格矛盾，保留待查'},{id:'ACCUSE',label:'认定订货人与店员合谋欺诈'}]},
 {id:'broken-window',title:'雨后破损的院窗',story:'庭院管理员伊莎只希望先弄清该如何修补，未委托你指认肇事者。窗边无人受伤，她允许你在安全隔离后查看碎片和窗框。',observations:['大部分碎片在院内，窗框上缘有一道新擦痕。','昨夜有风雨，院门并未整夜上锁；没有可用目击。'],hypotheses:['有东西从外侧撞到窗面。','风使窗扇碰到别的东西。','有人故意破窗，但目前没有身份线索。'],tests:[{id:'EDGE_INSPECTION',label:'用管理员的手套与灯检查断口、擦痕',result:'管理员先隔离碎片，再把原手套和灯交给你使用。你检查相接的断口及窗框，受力痕集中于外侧，足以支持外侧撞击；无物件或身份特征可区分飞物与人。检查后工具交还，碎片仍归管理员处理。',conclusion:'OUTSIDE_FORCE'},{id:'WEATHER_LOG',label:'核对本街当夜天气值班记录',result:'值班记录证实当夜有阵风和雨，却没有该窗的开闭状态或破损时间。天气是可能条件，不能单独证明它就是原因。',conclusion:'UNRESOLVED'}],conclusions:[{id:'UNRESOLVED',label:'目前只核实了天气条件，原因尚未定'},{id:'OUTSIDE_FORCE',label:'痕迹支持外侧受力，但不能指认是谁'},{id:'ACCUSE',label:'认定最后离院的人故意破窗'}]},
];
export const REASONER_ENVIRONMENT='本作G有限调查：可见痕迹、可访问原记录与本人愿意回答的内容才是依据。选择不同核实方法会得到不同的有限结果；推理不会自动指出真凶，也不能替代缺失证据。';
export const isReasonerActivity=(c:ReasonerCommand):c is ReasonerActivityCommand=>['EXAMINE','TEST','CONCLUDE','REFLECT'].includes(c.type);
function blocked(s:SliceState,c:ReasonerActivityCommand):string|null{
 if(s.status!=='ACTIVE')return '当前周目已结束。';
 if(s.progression.pathwayId!=='white-tower'||s.progression.sequence!==8)return '先成为推理学员。';
 if(s.activeEvent||s.combat)return '先处理当前事件或战斗。';
 if(s.health<=0||s.mind<=0)return '先休养恢复身体与精神。';
 if(s.world.city!=='BACKLUND')return '需本人回到原会面与调查地点。';
 if(s.actionsRemaining<1)return '需要1行动。';
 if(c.type==='REFLECT')return s.reasoner.reflected?'已经回看这三份调查。':CASES.some(p=>s.reasoner.cases[p.id]?.status!=='RESOLVED')?'先完成三份按实际证据交付的报告。':null;
 const p=CASES.find(p=>p.id===c.caseId),r=s.reasoner.cases[c.caseId];if(!p||!r)return '未知调查。';
 if(r.status==='RESOLVED')return '本次已经交付，不重复发奖。';
 if(c.type==='EXAMINE')return r.status==='AVAILABLE'?null:'已记录原现场，本次可以选择核实办法。';
 if(c.type==='TEST')return !p.tests.some(t=>t.id===c.testId)?'本案没有这项核实方法。':r.status!=='EXAMINED'?'先记录现场；已完成核实后需先交付本次报告。':r.attemptWeek===s.week?'本周核实或报告未成，下周再实际补查。':null;
 if(!p.conclusions.some(x=>x.id===c.conclusion))return '本案没有这项结论。';
 return r.status==='TESTED'?null:'先实际完成所选核实，不能凭尚未取得的结果报告。';
}
export function applyReasonerActivity(s:SliceState,c:ReasonerActivityCommand,ctx:SeerContext,award:(source:string,amount:5|8|25)=>void):void{
 const reason=blocked(s,c);if(reason)throw new Error(reason);s.actionsRemaining--;
 if(c.type==='REFLECT'){s.reasoner.reflected=true;s.seer.completedSources.push('reasoner-reflection');s.progression.acting=Math.min(100,s.progression.acting+25);ctx.note('能排除什么，仍不能确定什么','三案并非都必须含糊：完整对应存根能确认一次抄写错误，而相似靴底与一场风雨只能支持有限解释。你回看实际做过的核实、被退回的越界结论和保留的缺口。扮演+25。');return;}
 const p=CASES.find(p=>p.id===c.caseId)!,r=s.reasoner.cases[c.caseId]!;
 if(c.type==='EXAMINE'){r.status='EXAMINED';ctx.note(p.title,p.story+' 你实际记录：'+p.observations.join(' ')+' 暂列不同解释，尚未知道哪一个成立。');return;}
 if(c.type==='TEST'){r.attemptWeek=s.week;const result=ctx.check('knowledge',14);if(result.tier==='SUCCESS'||result.tier==='GREAT_SUCCESS'){r.status='TESTED';r.testId=c.testId;ctx.note(p.title,p.tests.find(t=>t.id===c.testId)!.result+' 请按这次实际核实选择结论。');}else ctx.note(p.title,'这次整理未能得到可依赖的核对结果，原现场记录保留，未取得的结果仍未知。本行动已花，下周可以选原方法或另一种方法再查。');return;}
 r.conclusion=c.conclusion;const test=p.tests.find(t=>t.id===r.testId)!;
 if(c.conclusion!==test.conclusion){r.status='EXAMINED';r.testId=null;r.mistakes++;r.attemptWeek=s.week;ctx.note(p.title,'委托人对照你本次实际取得的依据，指出报告不能从这些证据推出。报告与已花行动保留，未据此处罚任何人；下周重新核实后可以交付。');return;}
 r.status='RESOLVED';s.progression.acting=Math.min(100,s.progression.acting+25);award(`reasoner-case:${p.id}`,8);ctx.note(p.title,'报告接受：'+p.conclusions.find(x=>x.id===c.conclusion)!.label+'。依据仅为本次实际核实，不把其他未选方法的结果算作已知。扮演+25，已知能力单项掌握+8。');
}
export function reasonerActions(s:SliceState):ReasonerAction[]{if(s.progression.pathwayId!=='white-tower'||s.progression.sequence!==8)return [];const out:ReasonerAction[]=[];const add=(id:string,label:string,cost:string,command:ReasonerActivityCommand)=>{const reason=blocked(s,command);out.push({id,label,cost,command,reason,enabled:reason===null});};for(const p of CASES){const r=s.reasoner.cases[p.id]!;if(r.status==='AVAILABLE')add(`${p.id}-examine`,'记录本次获准的原现场与资料','1行动',{type:'EXAMINE',caseId:p.id});if(r.status==='EXAMINED')for(const t of p.tests)add(`${p.id}-${t.id}`,t.label,'1行动 · 知识难度14',{type:'TEST',caseId:p.id,testId:t.id});if(r.status==='TESTED')for(const x of p.conclusions)add(`${p.id}-${x.id}`,x.label,'1行动 · 依据本次实际核实',{type:'CONCLUDE',caseId:p.id,conclusion:x.id});}if(!s.reasoner.reflected)add('reasoner-reflect','回看判断成立与不成立的边界','1行动 · 三案后',{type:'REFLECT'});return out;}
export function reasonerCases(s:SliceState):ReasonerProjection['cases']{if(s.reasoner.promotionWeek===null)return [];return CASES.map(p=>{const r=s.reasoner.cases[p.id]!;return{id:p.id,title:p.title,story:p.story,observations:r.status==='AVAILABLE'?[]:[...p.observations],hypotheses:r.status==='AVAILABLE'?[]:[...p.hypotheses],testResult:r.testId?p.tests.find(t=>t.id===r.testId)!.result:null,result:r.status==='RESOLVED'?'已交付：'+p.conclusions.find(x=>x.id===r.conclusion)!.label:r.mistakes?'此前报告与实际依据不符，已退回补查。':null,status:r.status};});}
export function validateReasonerLife(s:SliceState):boolean{const m=s.reasoner;if(!m?.cases)return false;for(const p of CASES){const r=m.cases[p.id];if(!r)return false;if((r.status==='RESOLVED')!==s.seer.completedSources.includes(`reasoner-case:${p.id}`))return false;if(r.status==='AVAILABLE'&&(r.attemptWeek!==null||r.testId!==null||r.conclusion!==null||r.mistakes!==0))return false;if(['TESTED','RESOLVED'].includes(r.status)){const t=p.tests.find(t=>t.id===r.testId);if(!t||r.attemptWeek===null||r.status==='RESOLVED'&&r.conclusion!==t.conclusion)return false;}else if(r.testId!==null)return false;if(r.conclusion!==null&&!p.conclusions.some(x=>x.id===r.conclusion))return false;}return m.reflected===s.seer.completedSources.includes('reasoner-reflection')&&(!m.reflected||CASES.every(p=>m.cases[p.id]?.status==='RESOLVED'));}
