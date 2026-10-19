import { GATEKEEPER_GUIDE } from '../gatekeeper/content.js';
import type { UndyingAbilityId } from './types.js';

/** Only verified limits are canon; people, original objects, prices and mechanics are G. */
export const UNDYING_GUIDE = GATEKEEPER_GUIDE;
export const UNDYING_PRICES = { guidance: 520, potion: 6600, labourCredit: 5100 } as const;
export const UNDYING_MIN_GATEKEEPER_WEEKS = 12;
export const UNDYING_LABOUR_STEPS = 5;
export const UNDYING_BOTTLE_IDS = ['undying-potion-1', 'undying-potion-2', 'undying-potion-3'] as const;
export const UNDYING_FORMULA_STATUS = '不死者的完整主辅配方、材料名称与用量、完整晋升仪式条件和步骤尚未核实，保持未知。原联系人伊芙琳·沃斯只介绍本作原创G渠道实际取得的独立序列4成品原瓶；指导不解锁臆造材料采购、完整配方或自制魔药。收尸人至看门人的旧瓶、原灰羽与原木标记都不是新配方材料。专业准备方案G不声称已经还原原著仪式，也不声称无需仪式。';
export const UNDYING_RITUAL_SOURCE = '完整原著仪式仍未核实。伊芙琳介绍独立原创专业人员乔里·埃尔德（Jory Elder，67岁成年男性、不死者4，UDY4-JORY），由当前活着、自愿且实际在UDY4-HALL持照纪念准备室的本人监督；不把伊芙琳升级为半神。每次另付280便士、1行动预约，下一真实周亲自赴厅，另1行动由原专家把唯一原封装包带到原桌准备。0行动明确核对原人、原包、原身体可达、未知原著细节及六十年负担后，才开启本周服药窗口。服药无论成败均耗尽所选原瓶和该包，玩家仍在原厅，须0行动沿普通出口实际离场；取消不退费、不赠包、不移动专家或原灰羽。此为原创G专业准备，不是实际死亡演练，也不保证低风险。';
export const UNDYING_LIFECYCLE_BOUNDARY = '第五部第31章支持不死者每六十年周期性死去与复活，遗忘大部分过去记忆，再逐步恢复。它不是战斗复活冷却，也不保证任意致命伤后复生；尸身、灵魂与复起细节尚未核实，阿兹克更高层次的分魂诅咒不能直接套用。实际晋升日期及其六十年后同月同日为本作G首周年（闰日必要时记2月28日），这不是原著精确计时公式。完成原记忆准备后，可在长期章节经独立确认真实度过年代、周期死、七天G等待与三步有限寻回；跨小说末日后的时代明确属于本作G后世，不宣称原著未来。是否已经历以当前实际保存记录为准。普通战斗死亡与封存不变，不自动回满、复制身体、还原灵魂、跳过六十年或令见证人永生；记忆簿也不保证找回完整自我。';
export const UNDYING_SOURCE_STATUS = `死神途径序列4为不死者，下一序列3名称为摆渡人，本阶段不开放序列3能力。保留收尸人、掘墓人、通灵者、死灵导师与看门人的全部原ID、原掌握和实际历史，SG6-GRAY-FEATHER始终是同一个原灰羽。仅新增death.s4.underworld-seal，依据至少序列4可有限借冥界力量封印的方向制作本作G受限实现，不声称原著完整法术表或万能手套净化。旧死亡之语、体内小冥界和冥界门均继承；不开放无代价复活、任意高位封印、灵魂恢复或任意灵界传送。${UNDYING_LIFECYCLE_BOUNDARY}人物、场景、原物、价格、灵性、距离、时序、减势与全部判定均为原创G。`;
export const UNDYING_POTION_SOURCES = UNDYING_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${UNDYING_GUIDE}的独立不死者成品交接渠道实际封存第${index + 1}瓶序列4原瓶${id}；供给为原创G，不由收尸人至看门人旧瓶改装。完整配方仍未知，当前专业指导仪式与原封装包须另行准备。`,
}));
export const UNDYING_LABOUR_TASKS = ['核对本瓶独立封签', '清点本瓶原运输箱', '整理本瓶交接凭据', '核验本瓶原供应记录', '完成本瓶封存记录复核'] as const;
export const UNDYING_ABILITIES: { id: UndyingAbilityId; label: string; description: string }[] = [
  { id: 'death.s4.underworld-seal', label: '有限冥界借力封印', description: '借自己的原体内小冥界，有限约束本场已知低强度回响，或在普通对手一次攻击窗口中短暂减势。灵性、时限和判定为原创G，不是永久封印、万能净化、特性剥离、灵体赠送或战斗复活。实际停止维持后效果结束，原对象及历史保留；未知高位对象不在本场能力范围。' },
];
export const UNDYING_CONSUMPTION_RISK = '以下均为本作专业准备方案G：看门人消化100、晋升后满12整周、健康>20且精神>40，实际持有原瓶，并在本周由当前活着、自愿且在原厅的乔里亲自准备后，再独立确认饮药。0行动、意志难度28；四档都耗尽原瓶和本次唯一仪式包，窗口失效，仍须0行动沿普通出口实际离开。大成功：晋升、精神−8；成功：晋升、精神−15；失败：健康−15、精神−25、排异+30；灾难：健康−25、精神−45、排异+60。专业监督仅将此次药物排异健康与精神保底到1，不保护战斗。成功四属性各+1，旧掌握保留，一项新掌握从0、扮演归0，灵性上限120但当前不补满；身体性别、旧史和原灰羽不变。只登记六十年G预期日期，不声称已经历死亡或复活。失败仍为看门人，旧消化100与付出保留；下次须另付费、下一真实周带新原包重新到场。';
