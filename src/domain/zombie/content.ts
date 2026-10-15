import { WEREWOLF_GUIDE } from '../werewolf/content.js';
import type { ZombieAbilityId } from './types.js';
export { ZOMBIE_CASE_IDS } from './types.js';
export const ZOMBIE_GUIDE = WEREWOLF_GUIDE;
export const ZOMBIE_PRICES = { guidance: 360, potion: 3320, labourCredit: 3000 } as const;
export const ZOMBIE_MIN_WEREWOLF_WEEKS = 12;
export const ZOMBIE_LABOUR_STEPS = 5;
export const ZOMBIE_BOTTLE_IDS = ['zombie-potion-1', 'zombie-potion-2', 'zombie-potion-3'] as const;
export const ZOMBIE_SOURCE_STATUS = '《诡秘之主》第二部第118章支持序列6活尸拥有钢铁般的身体、超过狼人的力量、强大愈合力，以及冰霜、腐烂、驱使尸体与幽魂等死亡类魔法。坚硬身体是有限防护，马里奇承受五次左轮射击是该人物的具体表现，不是人人通用的手枪免疫公式。第三部第45章支持灵体攻击与太阳领域净化仍可伤害乃至杀死活尸；强大愈合不等于复活。第二部第117至118章所述节制者在满月承受剧痛、丧失战斗能力；本阶段以活尸诅咒替换旧序列发作形态，不重复收取旧狼人发作代价，旧记录保留。没有序列5虚化、穿墙、镜面跳跃、附身能力。当前只新增钢铁身体、有限死亡魔法两项掌握；囚犯、疯子、狼人原能力ID与掌握完整继承。哈伦、独立成品供给、原工坊三项实践、本人自愿配合的既存亡者赫姆、普通人里德、原月相告示与全部数值均为原创G。和平100是有实际代价的G玩法，不是原著保证的无代价消化法或诅咒解药。';
export const ZOMBIE_FORMULA_STATUS = '被缚者途径序列6活尸的完整晋升配方尚未核实；用药指导只说明本作原创G渠道实际供应的独立序列6成品原瓶，不解锁完整配方、原料采购或魔药制造，不编造材料。';
export const ZOMBIE_POTION_SOURCES = ZOMBIE_BOTTLE_IDS.map((id, index) => ({
  id, source: `${ZOMBIE_GUIDE}经独立活尸成品交接渠道实际取得的第${index + 1}瓶序列6活尸成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非囚犯、疯子或狼人旧瓶改装，未声称掌握完整配方。`,
}));
export const ZOMBIE_LABOUR_TASKS = ['核对本瓶独立封签', '整理原工坊普通存放格', '清点原浅盘与托架', '校对本瓶交接日期', '完成本瓶供货凭据复核'] as const;
export const ZOMBIE_ABILITIES: { id: ZombieAbilityId; label: string; description: string }[] = [
  { id: 'chained.s6.steel-body', label: '钢铁身体', description: '钢铁般的身体与超过狼人的力量提供有限身体防护和负荷处理能力，强大愈合不等于复活。不是无敌，也不能由本人坚硬反推敌人必然软弱或必胜；灵体攻击与太阳净化仍可造成伤害乃至死亡。不用射击、割伤或其它自伤测试防护。' },
  { id: 'chained.s6.death-craft', label: '有限死亡魔法', description: '原著支持冰霜、腐烂及驱使尸体或幽魂等死亡魔法；本阶段只实践原浅盘有限寒冷、向此地已经存在且本人明确自愿的成年亡者请求有限指认。不是召来或制造新幽魂，不复活、不读取所有死者记忆、不赋予全知，也没有序列5附身、虚化、穿墙或镜面跳跃。' },
];
export const ZOMBIE_CONSUMPTION_RISK = '以下数值为原创G：本次选定原瓶服药必耗，0行动，意志难度24；狼人消化100且晋升后满12整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。哈伦在场处理本次指导服药的排异，不随机即死；休养可恢复，原瓶不会复原。保护不适用于战斗、满月或其它危险。失败保留狼人消化与全部原掌握；成功只新增两项活尸掌握，从0开始，四属性各+1，灵性上限80但当前灵性不补满。活尸满月节制时的剧痛与不能战斗取代原序列发作，旧历史保留；沿用提前公示的八场有限G月相事件，不按四周推算。看守协助或独处须实际度过该段发作并消耗至多10或20精神；不恢复资源、不增加成长，节制、消化与普通替代食物都不保证解除诅咒。';
