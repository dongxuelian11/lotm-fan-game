import type {SliceState} from '../slice/types.js';
import type {SeerContext} from '../seer/index.js';
import type {ApothecaryAction,ApothecaryCommand} from './types.js';
type ClinicCommand=Extract<ApothecaryCommand,{type:'BUY_SUPPLIES'|'PREPARE_MEDICINE'|'USE_HEALING'|'EXAMINE'|'CARE'|'REFLECT'}>;
import {APOTHECARY_CASES as CASES} from './content.js';
export const isApothecaryClinic=(c:ApothecaryCommand):c is ClinicCommand=>['BUY_SUPPLIES','PREPARE_MEDICINE','USE_HEALING','EXAMINE','CARE','REFLECT'].includes(c.type);
function blocked(s:SliceState,c:ClinicCommand):string|null{
 if(s.tamer.companionId!==null)return '先完成动物协助，或0行动送回原动物。';
 if(s.status!=='ACTIVE')return '当前周目已结束。';if(s.progression.pathwayId!=='moon'||![9,8,7,6,5].includes(s.progression.sequence??0))return '先成为药师并接受诊所指导。';if(s.activeEvent||s.combat)return '先处理当前事件或战斗。';if(s.health<=0||s.mind<=0)return '先休养恢复身体与精神。';if(s.world.city!=='BACKLUND')return '需要本人返回原诊所。';
 if(c.type!=='BUY_SUPPLIES'&&s.actionsRemaining<1)return '需要1行动。';const m=s.apothecary.clinic;
 if(s.progression.sequence!==9&&!['BUY_SUPPLIES','PREPARE_MEDICINE','USE_HEALING'].includes(c.type))return '这段药师实践已保留，请在驯兽师页积累新的扮演。';
 if(c.type==='BUY_SUPPLIES')return m.supplyWeek===s.week?'本周三份原封药基已经交付，下周才有下一批。':s.cash<36?'三份原封药基共36便士。':null;
 if(c.type==='PREPARE_MEDICINE')return m.materials<1?'先取得一份诊所封装药基。':null;
 if(c.type==='USE_HEALING')return m.healing<1?'没有实际制备的外伤护理剂。':s.health>=100?'当前无需消耗外伤护理剂。':null;
 if(c.type==='REFLECT')return s.apothecary.reflected?'已整理本段护理经历。':CASES.some(x=>s.apothecary.cases[x.id]?.status!=='RESOLVED')?'先完成三位当事人的有限护理或转诊。':null;
 const r=s.apothecary.cases[c.caseId];if(!r||!CASES.some(x=>x.id===c.caseId))return '未知当事人。';if(r.status==='RESOLVED')return '本次护理已有记录，不重复成长。';if(c.type==='EXAMINE')return r.status==='AVAILABLE'?null:'已经取得本人配合并记录本次可见情况。';
 if(r.status!=='EXAMINED')return '先亲自查看当事人的情况，不能远程投药。';if(c.choice==='CARE'&&c.caseId==='workshop-cut'&&m.healing<1)return '需要1份已经制备的原外伤护理剂。';if(c.choice==='CARE'&&c.caseId==='shaken-courier'&&m.calming<1)return '需要1份已经制备的原安神剂。';return null;
}
export function applyApothecaryClinic(s:SliceState,c:ClinicCommand,ctx:SeerContext,award:(source:string,amount:5|8|25)=>void){const reason=blocked(s,c);if(reason)throw new Error(reason);const m=s.apothecary.clinic;if(c.type!=='BUY_SUPPLIES')s.actionsRemaining--;
 if(c.type==='BUY_SUPPLIES'){s.cash-=36;m.materials+=3;m.purchased+=3;m.supplyWeek=s.week;ctx.note('三份原封药基已交付','诊所将本周三份虚构封装药基交给你，每份仅够一次制备。药基是本作游戏耗材，不是晋升魔药原料，也不提供现实配药方法。');return;}
 if(c.type==='PREPARE_MEDICINE'){m.materials--;const result=ctx.check('knowledge',10);if(result.tier==='SUCCESS'||result.tier==='GREAT_SUCCESS'){if(c.kind==='HEALING')m.healing++;else m.calming++;ctx.note('本次药剂已制备',`你在导师指导下用掉一份原封药基，制成一份${c.kind==='HEALING'?'外伤护理剂':'安神剂'}。原份耗材不能再次使用；这里的步骤与数值为虚构游戏规则。`);}else{m.spent++;ctx.note('制备未通过检查','这一份药基已经消耗，但结果不合格，按诊所规定废弃，没有交给患者或假记成品。');}return;}
 if(c.type==='USE_HEALING'){m.healing--;m.spent++;const before=s.health;s.health=Math.min(100,s.health+12);ctx.note('实际用掉一份护理剂',`健康${before}→${s.health}。原重伤及未处置状态保留，仍需正规处置与休养；不复活、不再生肢体、不清除污染。`);return;}
 if(c.type==='REFLECT'){s.apothecary.reflected=true;s.seer.completedSources.push('apothecary-reflection');s.progression.acting=Math.min(100,s.progression.acting+25);ctx.note('疗效、限度与责任','你整理用掉的原药剂、亲见反应和仍然未知的病因。药师需要知道何时施以有限护理，何时让当事人获得进一步诊治。扮演+25。');return;}
 const spec=CASES.find(x=>x.id===c.caseId)!,r=s.apothecary.cases[c.caseId]!;
 if(c.type==='EXAMINE'){r.status='EXAMINED';ctx.note(spec.title,`${spec.story} ${spec.observations.join(' ')}`);return;}
 if(c.choice==='CARE'){if(c.caseId==='workshop-cut'){m.healing--;m.spent++;r.health+=12;}else if(c.caseId==='shaken-courier'){m.calming--;m.spent++;r.mind+=10;}}
 r.status='RESOLVED';r.choice=c.choice;s.progression.acting=Math.min(100,s.progression.acting+25);award(`apothecary-case:${c.caseId}`,8);ctx.note(spec.title,(c.choice==='CARE'?spec.result:'你把已亲见的情况如实交给诊所，由本人接受进一步诊治。没有消耗不相干药剂，当前健康与精神没有凭空改变，后续疗效仍待观察。')+' 本次护理交接完成：扮演+25，单项掌握+8。');
}
export function apothecaryCases(s:SliceState){if(s.progression.pathwayId!=='moon')return [];return CASES.map(x=>{const r=s.apothecary.cases[x.id]!;return{id:x.id,title:x.title,story:x.story,observations:r.status==='AVAILABLE'?[]:[...x.observations],result:r.status==='RESOLVED'?(r.choice==='CARE'?x.result:'已向诊所如实交接，当前健康与精神没有变化；后续疗效待观察。'):null,status:r.status,health:r.status==='AVAILABLE'?null:r.health,mind:r.status==='AVAILABLE'?null:r.mind};});}
export function apothecaryClinicActions(s:SliceState):ApothecaryAction[]{if(s.progression.pathwayId!=='moon')return [];const out:ApothecaryAction[]=[];const add=(id:string,label:string,cost:string,command:ClinicCommand)=>{const reason=blocked(s,command);out.push({id,label,cost,command,enabled:reason===null,reason});};add('clinic-supply','领取本周三份封装药基','0行动 · 36便士 · 每周一次',{type:'BUY_SUPPLIES'});add('clinic-healing','制备外伤护理剂','1行动 · 1份药基 · 知识难度10',{type:'PREPARE_MEDICINE',kind:'HEALING'});add('clinic-calming','制备安神剂','1行动 · 1份药基 · 知识难度10',{type:'PREPARE_MEDICINE',kind:'CALMING'});if(s.apothecary.clinic.healing>0)add('clinic-self','使用一份自己的外伤护理剂','1行动 · 原药剂−1 · 健康+12，重伤仍需处置',{type:'USE_HEALING'});
 if(s.progression.sequence!==9)return out;
 for(const x of CASES){const r=s.apothecary.cases[x.id]!;if(r.status==='AVAILABLE')add(`examine-${x.id}`,`查看：${x.title}`,'1行动 · 当事人同意，普通观察与气场线索',{type:'EXAMINE',caseId:x.id});if(r.status==='EXAMINED'){add(`care-${x.id}`,x.care,`1行动${x.id==='workshop-cut'?' · 原外伤护理剂−1':x.id==='shaken-courier'?' · 原安神剂−1':' · 不乱试药'}`,{type:'CARE',caseId:x.id,choice:'CARE'});add(`refer-${x.id}`,'交由诊所继续诊治','1行动 · 当前数值不凭空恢复',{type:'CARE',caseId:x.id,choice:'REFER'});}}
 if(!s.apothecary.reflected)add('clinic-reflect','整理这段护理的成果与限度','1行动 · 三项完成后扮演+25',{type:'REFLECT'});return out;}
export function validateApothecaryClinic(s:SliceState){const a=s.apothecary,m=a.clinic;if(m.purchased!==m.materials+m.healing+m.calming+m.spent||m.purchased%3!==0||(m.purchased===0)!==(m.supplyWeek===null))return false;for(const x of CASES){const r=a.cases[x.id];if(!r)return false;if((r.status==='RESOLVED')!==(r.choice!==null)||(r.status==='RESOLVED')!==s.seer.completedSources.includes(`apothecary-case:${x.id}`))return false;const care=r.status==='RESOLVED'&&r.choice==='CARE';if(r.health!==x.health+(care&&x.id==='workshop-cut'?12:0)||r.mind!==x.mind+(care&&x.id==='shaken-courier'?10:0))return false;}const usedOnPatients=['workshop-cut','shaken-courier'].filter(id=>a.cases[id]?.status==='RESOLVED'&&a.cases[id]?.choice==='CARE').length;if(m.spent<usedOnPatients)return false;return a.reflected===s.seer.completedSources.includes('apothecary-reflection')&&(!a.reflected||CASES.every(x=>a.cases[x.id]?.status==='RESOLVED'));}
