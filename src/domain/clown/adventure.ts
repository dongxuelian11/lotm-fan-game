import type {SliceState} from '../slice/types.js';
import type {SeerContext} from '../seer/index.js';
import type {ClownCommand,ClownAction} from './types.js';
const LESSONS=[
 {id:'quiet-support',title:'把自己的失落暂放一旁',body:'老道具师没有通过返聘，你陪他收拾确实属于他的工具。你承认自己的失落，以平稳表情听完告别，不假装他的困难已经解决。',stat:'will' as const,difficulty:12,spirituality:0},
 {id:'unexpected-stage',title:'失误后的最后一幕',body:'公开排练的一处普通道具故障让演出暂停。你从安全低台下来，向观众如实说明，以受控的身体动作完成临时收场；失败不假称无人察觉。',stat:'perception' as const,difficulty:12,spirituality:1},
 {id:'balance-rehearsal',title:'停在窄台边缘',body:'道具师朱迪丝借出剧院内一块离地很低的排练台，你先检查干燥台面，再练习控制每一步的重心；旁边留有正常下台的空间。',stat:'perception' as const,difficulty:12,spirituality:2},
 {id:'paper-target',title:'一张纸与固定靶',body:'指导者把厚软木靶固定在无人通行的练习区。只使用你实际买来的普通纸，投出的一张不回库存，也不对真人练刀。',stat:'physique' as const,difficulty:12,spirituality:1},
 {id:'composed-apology',title:'在责备声中把话说完',body:'你在整理剧院告示时漏掉了排练时刻，朱迪丝当面提出责备。练习稳住表情并诚实道歉，不把角色表情当作自己没有难过，也不否认这次疏漏。',stat:'will' as const,difficulty:12,spirituality:0},
];
export const CLOWN_RESCUE_STORY='快递员艾尔西在公开码头巷口被一名持短棍者拦住，对方索要无凭据的通行费。她仍抱着自己受托的包裹。你可以当面交涉，也可以明确承担真实受伤/死亡风险介入；退离不会替她解决冲突，包裹也不会成为你的战利品。';
function common(s:SliceState){return s.status!=='ACTIVE'?'当前周目无法行动。':s.progression.pathwayId!=='diviner'||s.progression.sequence!==8?'成为小丑后才能进行这些实践。':s.world.city!=='BACKLUND'?'需要在贝克兰德。':s.activeEvent||s.combat?'先处理当前事件或战斗。':s.health<=0||s.mind<=0?'先休养恢复身体与精神。':s.actionsRemaining<1?'本周剩余行动不足。':null;}
function blocked(s:SliceState,c:ClownCommand):string|null{
 const reason=common(s);if(reason)return reason;
 if(c.type==='PRACTICE'){
  const lesson=LESSONS.find(x=>x.id===c.practiceId);if(!lesson)return '未知的练习。';
  if(s.clown.practices.includes(lesson.id))return '这项实践已完成，不重复发奖。';
  if(s.clown.trainingAttempts[lesson.id]===s.week)return '本周已经尝试过，下周再练。';
  if(s.spirituality<lesson.spirituality)return `需要${lesson.spirituality}点灵性。`;
  if(lesson.id==='paper-target'&&s.clown.paperSheets<1)return '需要一张实际持有的普通纸。';
  return null;
 }
 if(c.type!=='RESCUE_TALK'&&c.type!=='RESCUE_FIGHT')return '未知的护送行动。';
 if(!s.clown.practices.length)return '先完成至少一项小丑实践，确认身体已经适应。';
 if(s.clown.rescue.status!=='AVAILABLE')return '这次护送已经有了结果，不能重开刷取。';
 if(c.type==='RESCUE_TALK'&&s.clown.rescue.attemptWeek===s.week)return '本周的交涉已经尝试过。可另花一次行动介入，或下周再谈。';
 return null;
}
export function clownAdventureActions(s:SliceState):ClownAction[]{
 if(s.progression.pathwayId!=='diviner'||s.progression.sequence!==8)return [];
 const add=(id:string,label:string,cost:string,command:ClownCommand):ClownAction=>{const reason=blocked(s,command);return{id,label,cost,command,enabled:!reason,reason};};
 return [
 ...LESSONS.filter(x=>!s.clown.practices.includes(x.id)).map(x=>add(x.id,x.title,`1行动 · ${x.spirituality}灵性${x.id==='paper-target'?' · 1张原纸':''} · ${x.body}`,{type:'PRACTICE',practiceId:x.id})),
 ...(s.clown.rescue.status==='AVAILABLE'?[
 add('clown-rescue-talk','陪快递员当面交涉',`1行动 · 意志难度14 · 成功护送离开，失败不转移原物`,{type:'RESCUE_TALK'}),
 add('clown-rescue-fight','介入护送冲突',`1行动 · 真实战斗，可能受伤或死亡；纸飞刀逐张消耗原纸`,{type:'RESCUE_FIGHT'}),
 ]:[]),
 ];
}
export function applyClownAdventure(s:SliceState,c:ClownCommand,ctx:SeerContext,award:(source:string,amount:5|8|25)=>void):void{
 const reason=blocked(s,c);if(reason)throw new Error(reason);
 s.actionsRemaining--;
 if(c.type==='PRACTICE'){
  const lesson=LESSONS.find(x=>x.id===c.practiceId)!;s.spirituality-=lesson.spirituality;s.clown.trainingAttempts[lesson.id]=s.week;
  if(lesson.id==='paper-target'){s.clown.paperSheets--;s.clown.paperSpent++;}
  const r=ctx.check(lesson.stat,lesson.difficulty),ok=r.tier==='SUCCESS'||r.tier==='GREAT_SUCCESS';
  if(ok){s.clown.practices.push(lesson.id);award(`clown-practice:${lesson.id}`,8);s.progression.acting=Math.min(100,s.progression.acting+16);}
  ctx.note(lesson.title,`${lesson.body} 本次${ok?'完成练习，扮演+16；已知能力中一项掌握+8。':'未能稳定完成，没有成长奖励，下周可以再试。'}${lesson.id==='paper-target'?'投出的原纸已经消耗。':''}`);return;
 }
 s.clown.rescue.attemptWeek=s.week;
 if(c.type==='RESCUE_TALK'){
  const r=ctx.check('will',14),ok=r.tier==='SUCCESS'||r.tier==='GREAT_SUCCESS';
  if(ok){s.clown.rescue.status='RESCUED';award('clown-rescue',8);s.progression.acting=Math.min(100,s.progression.acting+20);ctx.note('快递员走出巷口','你没有虚构身份或付出并不存在的费用。当面的坚定交涉让对方退让，艾尔西仍持自己的原包裹走向送货街道。扮演+20，掌握+8。');}
  else ctx.note('交涉没有奏效','对方不肯退让。艾尔西仍持原包裹，现场没有凭空转移；你可稍后再谈，或明确选择有风险的介入。');
  return;
 }
 s.clown.rescue.status='FIGHTING';s.clown.rescue.startHistoryIndex=s.combatHistory.length;
 s.combat={encounterId:'CLOWN_RESCUE',round:1,enemyHealth:100,enemyMind:100,enemyInjuries:[],enemyRisk:0,enemyStatus:'RESISTING',lastRound:null};
 ctx.note('巷口护送冲突',CLOWN_RESCUE_STORY+' 你已花费本次行动走到现场介入。普通敌人使用短棍；纸飞刀逐张消耗你实际携带的纸。');
}
export function settleClownRescue(s:SliceState,outcome:string,ctx:SeerContext,award:(source:string,amount:5|8|25)=>void){
 if(outcome==='CONTINUE')return;
 const rescue=s.clown.rescue;
 rescue.enemyStatus=s.combat!.enemyStatus;
 if(outcome==='PLAYER_DEAD')rescue.status='LOST';
 else if(outcome==='RETREATED')rescue.status='RETREATED';
 else {rescue.status='RESCUED';s.progression.acting=Math.min(100,s.progression.acting+20);}
 const rounds=s.combatHistory.slice(rescue.startHistoryIndex??s.combatHistory.length);
 if(outcome!=='PLAYER_DEAD'&&rounds.some(r=>r.retreat==='NONE'&&r.moves.some(m=>m.actor==='PLAYER'&&(m.selfGain>0||m.enemyReduction>0))))award('clown-rescue',25);
 ctx.note('巷口护送结果',rescue.status==='RESCUED'?'抵抗已经结束。艾尔西带着自己原有的包裹离开，原物仍归原主人，你没有获得战利品。':rescue.status==='RETREATED'?'你已经离开本场，快递员和包裹的后续仍待确认；没有把他们自动带走。':'你已死亡，护送没有被记作完成，包裹没有转入你的库存。');
 s.combat=null;
}
export function validateClownAdventure(s:SliceState):boolean{
 const x=s.clown;if(!Array.isArray(x.practices)||new Set(x.practices).size!==x.practices.length||x.practices.some(id=>!LESSONS.some(l=>l.id===id)))return false;
 if(!x.trainingAttempts||Object.entries(x.trainingAttempts).some(([id,week])=>!LESSONS.some(l=>l.id===id)||!Number.isSafeInteger(week)||week<1||week>s.week))return false;
 if(x.practices.some(id=>!s.seer.completedSources.includes(`clown-practice:${id}`)))return false;
 const r=x.rescue;if(!r||!['AVAILABLE','FIGHTING','RESCUED','RETREATED','LOST'].includes(r.status)||!['RESISTING','SURRENDERED','DEAD'].includes(r.enemyStatus)||r.parcelOwner!=='courier-elsie'||r.parcelHolder!=='COURIER')return false;
 return (r.attemptWeek===null||Number.isSafeInteger(r.attemptWeek)&&r.attemptWeek>=1&&r.attemptWeek<=s.week)&&(r.startHistoryIndex===null||Number.isSafeInteger(r.startHistoryIndex)&&r.startHistoryIndex>=0&&r.startHistoryIndex<=s.combatHistory.length)&&(r.status!=='FIGHTING'||s.combat?.encounterId==='CLOWN_RESCUE');
}
