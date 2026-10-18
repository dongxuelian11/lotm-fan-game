import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
type Command = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' };
export const FACELESS_ENCOUNTER_STORY = '排练结束，成年搬运员达恩因交接误会持自己的普通短棍堵住后门内的空通道。你与他相距2米，身后原出口仍可退出；他已经看见你的本来样子，换脸不令他失忆。可以当面澄清，也可以承担战斗风险；没有人或物随胜负自动转移。（G）';
export function blockFacelessEncounter(s:SliceState,c:Command):string|null {
 if(s.status!=='ACTIVE'||s.health<=0||s.mind<=0)return '先恢复身体与精神。';
 if(s.progression.pathwayId!=='diviner'||s.progression.sequence!==6)return '先成为无面人。';
 if(s.activeEvent||s.combat)return '先处理当前事件或战斗。';
 if(s.world.city!=='BACKLUND')return '需要在贝克兰德原排练场。';
 if(Object.values(s.faceless.cases).some(x=>x.contactOpen))return '先实际结束当前实践接触。';
 if(!Object.values(s.faceless.cases).some(x=>x.status==='RESOLVED'))return '先完成一次实际无面人实践与报告。';
 if(s.faceless.outfit.location==='PLAYER')return '先归还借来的原道具服，不能把场方物带去冲突。';
 if(s.faceless.encounter.status!=='AVAILABLE')return '这段后门争议已有结果，不能重复开启。';
 if(s.actionsRemaining<1)return '本次选择需要1行动。';
 return c.type==='ENCOUNTER_TALK'&&s.faceless.encounter.attemptWeek===s.week?'本周已交涉，可下周继续或选择退出。':null;
}
export function applyFacelessEncounter(s:SliceState,c:Command,ctx:SeerContext):void {
 const reason=blockFacelessEncounter(s,c);if(reason)throw new Error(reason);
 s.actionsRemaining--;const e=s.faceless.encounter;e.attemptWeek=s.week;
 if(c.type==='ENCOUNTER_TALK'){
  const result=ctx.check('will',16);
  if(result.tier==='SUCCESS'||result.tier==='GREAT_SUCCESS'){e.status='RESOLVED';ctx.note('原通路重新开放','达恩接受交接澄清并自行让路；没有改写他的记忆，没有额外扮演奖励，当前外貌仍保留。');}
  else ctx.note('达恩仍不愿让路','本次交涉花费1行动，未改写对方意愿；可以离开，之后下周再交涉，或选择承担真实战斗风险。');
  return;
 }
 e.status='FIGHTING';e.startHistoryIndex=s.combatHistory.length;
 s.combat={encounterId:'FACELESS_DISPUTE',round:1,enemyHealth:100,enemyMind:100,enemyInjuries:[],enemyRisk:0,enemyStatus:'RESISTING',lastRound:null};
 ctx.note('排练后门的冲突',FACELESS_ENCOUNTER_STORY+'本次1行动已付；原已点燃随身灯可用，没准备就没有火源。');
}
export function settleFacelessEncounter(s:SliceState,outcome:string,ctx:SeerContext,award:(source:string,amount:5|8|25)=>void):void {
 const e=s.faceless.encounter;if(e.status!=='FIGHTING'||s.combat?.encounterId!=='FACELESS_DISPUTE')throw new Error('没有正在进行的无面人后门冲突。');
 if(outcome==='CONTINUE')return;
 e.status=outcome==='PLAYER_DEAD'?'LOST':outcome==='RETREATED'?'RETREATED':'RESOLVED';
 const effective=s.combatHistory.slice(e.startHistoryIndex??s.combatHistory.length).some(r=>r.retreat==='NONE'&&r.moves.some(m=>m.actor==='PLAYER'&&(m.selfGain>0||m.enemyReduction>0)));
 if(e.status==='RESOLVED'&&effective)award('faceless-dispute',25);
 s.magician.lantern.prepared=false;s.combat=null;
 ctx.note('后门冲突结束',e.status==='LOST'?'真实死亡已经结算，没有复活或奖励。':e.status==='RETREATED'?'你从原出口实际退出，达恩和原短棍仍留原处。原外貌、消耗与伤势保留。':'抵抗结束；原短棍不会归你。有效参战给予一次掌握成长，外貌仍保留，灯火已熄灭。');
}
