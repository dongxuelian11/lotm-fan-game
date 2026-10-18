import { SUMMONING_MASTER_GUIDE } from '../summoning-master/content.js';
import type { LifeGiverAbilityId, LifeGiverPreparationId } from './types.js';

/** Moon S2/S1 names and numbering are verified; every new playable mechanic is G. */
export const LIFE_GIVER_GUIDE = SUMMONING_MASTER_GUIDE;
export const LIFE_GIVER_PRICES = { guidance: 500, potion: 6200, labourCredit: 5400, preparation: 120 } as const;
export const LIFE_GIVER_MIN_SUMMONING_MASTER_WEEKS = 12;
export const LIFE_GIVER_LABOUR_STEPS = 5;
export const LIFE_GIVER_BOTTLE_IDS = ['life-giver-potion-1', 'life-giver-potion-2', 'life-giver-potion-3'] as const;
export const LIFE_GIVER_FORMULA_STATUS = '月亮序列2创生者与序列1美神的名称和编号已明确核实；创生者完整配方、晋升仪式和具体新能力均未知，不能断言原著无需仪式。本阶段使用明确原创G专业支持、独立序列2原瓶和实际准备，不把三项支持步骤冒充已核实仪式，也不复用旧巫王仪式包或召唤大师药瓶。';
export const LIFE_GIVER_SOURCE_STATUS = '创生者在本次已核正文中仅有名称，不能由名称推导造生命、造灵魂、无限召唤或血中复活。有限活性支持与有限共同庇护均为本作原创G，只作用于场景中已有的真实身体，保留成本、失败、伤亡、同意与退出。身体性别变化属于下一阶美神1，本阶不改变性别；旧候选赋生、血锚和永久载体不视为已核能力，不在本切片开放。';
export const LIFE_GIVER_POTION_SOURCES = LIFE_GIVER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${LIFE_GIVER_GUIDE}的独立创生者成品交接渠道本作G初始批次第${index + 1}瓶序列2原瓶${id}；非召唤大师或更早原瓶改装，完整配方及原著仪式仍未知，G专业支持必须另行实际准备。`,
}));
export const LIFE_GIVER_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶原箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const LIFE_GIVER_PREPARATIONS: { id: LifeGiverPreparationId; title: string; description: string }[] = [
  { id: 'INSPECT_SOURCE', title: '核验原指导来源与新原瓶边界', description: '本人实际核对原格蕾丝渠道的新序列2封存与交接记录，明确旧流灯已有独立意识、原身体与原居处；指导不创造对象，不把历史联系改成新场景同意，也不把旧召唤大师剩余原瓶升级。' },
  { id: 'CHECK_ORIGINAL', title: '检查原身体、原物与既有后果', description: '本人在原场核对自己的真实身心、伤势与旧记录，以及流灯同一身体和原声片、艾达原牌、原遮板和纸张既有状态。检查只记录当前实情，不治疗、不补精力、不重置原物；已死亡或已耗尽者如实留档，不要求其复原才能完成检查。' },
  { id: 'PLAN_WITHDRAWAL', title: '演练停止支持与普通撤离', description: '本人沿原场普通出口与已知30米小径演练停止支持、归还实际借物与普通返回次序，明确失效不删除在场身体、同意可拒绝或撤回。三项均为本作G专业准备，不预先完成新实践，也不冒充未知的创生者仪式。' },
];
export const LIFE_GIVER_ABILITIES: { id: LifeGiverAbilityId; label: string; description: string }[] = [
  { id: 'moon.s2.bounded-vitality', label: '有限活性支持（G）', description: '本作原创G有限支持，目标只能是当前确实存在且仍活着的原身体。须同一原流灯当次在场、仍活着且实际疲劳并同意；6灵性和一粒真实60便士原月珠、知识18，每次最多恢复12精力，健康/精神不变；失败保留成本并可普通收尾。不创造生命或灵魂、不复制来客、不复活、不清除旧伤与累计死亡风险。' },
  { id: 'moon.s2.shared-shelter', label: '有限共同庇护（G）', description: '本作原创G有限合作保护，只对当次实际在场、愿意的原对象及已写场景生效。4灵性和一粒真实60便士原月珠、知识18；生活15秒窗口或本轮窗口仅在下一次真实合作应用，原精力成本8降3且本人实扣5健康；战斗再减敌势20G。能失败或中断，未应用不扣健康、不算保护成功；不能抵消已提交的死亡，不能让来客失去独立意愿，不能凭旧案或旧埃德温许可自动生效，不提供额外身体或免费独立轮盘。' },
];
export const LIFE_GIVER_CONSUMPTION_RISK = '全部具体条件均为本作G：召唤大师消化100、从召唤大师实际晋升周起12整周、健康>20且精神>40；三项不同的1行动专业准备完成，另付1行动及120便士检查当周场地。0行动独立确认服用所选原瓶，意志难度30。大成功：晋2、精神−8；成功：晋2、精神−15；失败：仍3、健康−15、精神−25、排异+30；灾难：仍3、健康−25、精神−45、排异+60。原瓶与本次场地准备均耗尽，三项真实专业经历及全部失败记录保留。G专业支持仅将本次药物排异后的健康和精神保底到1，不保护普通死亡或战斗。成功四属性各+1，七阶19项旧掌握原值和召唤大师消化100、实际晋升周保留，两新项从0起；灵性上限仍120且当前不补满，不变性、不治疗、不清伤势风险。原血食、动物、药瓶、纸张、流灯同一身体/原声片、旧人物和原物维持真实状态，不发免费召唤库存。初始三瓶全部失败耗尽后，可花1行动申请，下一真实周起收三瓶新的独立原瓶；它们仍须实际付费或分别完成五项劳务，旧瓶不复原。';
