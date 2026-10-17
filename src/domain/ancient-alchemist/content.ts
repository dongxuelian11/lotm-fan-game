import { DRUID_GUIDE } from '../druid/content.js';
import type { AncientAlchemistAbilityId } from './types.js';

/** The S4 name and life-alchemy direction have source support; the finite prototypes and mechanics are original G. */
export const ANCIENT_ALCHEMIST_GUIDE = DRUID_GUIDE;
export const ANCIENT_ALCHEMIST_PARTNER_ID = 'AA4-NORA-BELL';
export const ANCIENT_ALCHEMIST_PARTNER = '诺拉·贝尔';
export const ANCIENT_ALCHEMIST_STEM_ID = 'AA4-STEM-1';
export const ANCIENT_ALCHEMIST_TRAY_ID = 'AA4-TRAY-1';
export const ANCIENT_ALCHEMIST_RECORD_ID = 'AA4-RECORD-1';
export const ANCIENT_ALCHEMIST_PRICES = { guidance: 540, potion: 6800, labourCredit: 5300 } as const;
export const ANCIENT_ALCHEMIST_MIN_DRUID_WEEKS = 12;
export const ANCIENT_ALCHEMIST_LABOUR_STEPS = 5;
export const ANCIENT_ALCHEMIST_BOTTLE_IDS = ['ancient-alchemist-potion-1', 'ancient-alchemist-potion-2', 'ancient-alchemist-potion-3'] as const;
export const ANCIENT_ALCHEMIST_SOURCE_STATUS = '古代炼金师是母亲途径序列4，承接德鲁伊5，与通识者途径的炼金术士4不同。第五部第143章出现古典炼金师4的旧称信息，现代称古代炼金师，更早又称人体炼金师；生命炼成方向有原文支持，完整配方、晋升仪式与具体制造机制仍未知。第七部第55章支持下一阶抬棺人3的名称，其能力不在本切片开放。老尼尔受隐匿贤者影响的复活尝试不是安全职业能力模板，生命手杖不是纯序列4模板，弗兰克创造灵魂的研究目标也不等于已经证实的能力。生命炼成不推导无代价复活、造人造魂、任意动物变形或无限食物。新原活苗AA4-STEM-1、托盘AA4-TRAY-1、有限材料包、60秒活性基质、三段式有限护腕、原记录纸AA4-RECORD-1、新成年苗圃助手诺拉·贝尔与新成年奥斯里克·维尔，以及费用、距离、时长、判定和全部具体机制均为本作原创G。原伊芙·莫兰、旧马伦的既有结局与全部旧五阶段保持同一原人原物原历史，不授予组织身份或保证一般安全消化。';
export const ANCIENT_ALCHEMIST_FORMULA_STATUS = '古代炼金师完整配方与晋升仪式细节尚未核实，不能据未知细节断言无需仪式。主辅材料、用量、调配顺序与完整仪式步骤保持未知。本作原创G渠道只交付三瓶独立成品原瓶；同一位原成年苗圃照料员伊芙·莫兰实际核对本次原瓶、准备原苗圃训练园安静服药位置并在场照护。这是明确的G专业准备流程，不冒充已还原原著仪式，也不解锁配方、材料采购或魔药调配。耕种者、医师、丰收祭司、生物学家与德鲁伊五个旧阶段的原瓶、晋升、原人物、原物、能力、风险和历史完整保留。';
export const ANCIENT_ALCHEMIST_POTION_SOURCES = ANCIENT_ALCHEMIST_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${ANCIENT_ALCHEMIST_GUIDE}经独立古代炼金师成品交接渠道实际取得的第${index + 1}瓶序列4古代炼金师成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非耕种者、医师、丰收祭司、生物学家或德鲁伊旧瓶改装，未声称掌握完整配方或还原晋升仪式。`,
}));
export const ANCIENT_ALCHEMIST_LABOUR_TASKS = ['核对本瓶独立封签', '整理原苗圃公开交接册', '清点新台面普通记录用品', '复核本瓶原交付凭据', '完成本瓶供货记录核验'] as const;
export const ANCIENT_ALCHEMIST_ABILITIES: { id: AncientAlchemistAbilityId; label: string; description: string }[] = [
  {
    id: 'mother.s4.vital-knit', label: '有限活茎修补',
    description: '对同一原盆中仍活着、原有表浅损伤的AA4-STEM-1进行有限修补。先实际花1行动80便士购买已登记的有限材料包；实施另1行动4灵性、知识18，成功只稳定原损伤，失败仍有未解决损伤且材料包照耗。普通方法0灵性、知识10只作普通支撑绑缚。须实际在原台观察6小时并归还同一原盆后才能收束；成功能力报告才加该项8掌握。不是复活、永久治愈或造魂。材料、机制、成本与判定均为原创G。',
  },
  {
    id: 'mother.s4.living-matrix', label: '有限活性基质',
    description: '以另一个实际购买的有限材料包在原AA4-TRAY-1形成唯一登记的基质；实施1行动4灵性、知识18，成功仅有60秒有限反应，无心智、灵魂或独立人格。原0.5千克试块只滑动一次，测试实耗10秒；停止时实际等完60秒，同一基质成为不可复苏、不可充能的惰性残体，再普通往返2米交还。普通方法只制非活性编织垫，失败保留已耗材料。实战另付1行动120便士4灵性，以独立登记材料制三段式原护腕；每次B另4灵性、知识18并耗一段，成功仅把下一次正贡献BODY或ARC乘0.6一次，60秒有界、轮末到期，不叠加；失败照耗，耗尽回退旧观察。不复制、造魂或无限产生物质，全部具体原型与规则为原创G。',
  },
];
export const ANCIENT_ALCHEMIST_CONSUMPTION_RISK = '以下准备、时间、代价与判定均为原创G：原成年伊芙在场核对本次原瓶、实际准备原苗圃训练园安静位置并照护；服药必耗选定原瓶，0行动，意志难度28。服药前健康须高于20、精神须高于40，德鲁伊消化100且晋升后满12整周，并先结束全部新旧接触、事件和战斗。大成功：晋升、精神−4；成功：晋升、精神−8、灵性−15（最低0）；失败：未晋升、精神−25、健康−15、排异+30；灾难：中断晋升、精神−45、健康−25、排异+60。仅本次G指导服药的健康与精神最低1，保护不适用于战斗或其它危险；原瓶必耗，失败保留德鲁伊消化及所有旧掌握，休养后另购新原瓶。成功四属性各+1，灵性上限120但当前灵性不补满，古代炼金师扮演从0开始，仅新增有限活茎修补、有限活性基质两项0掌握。原五个阶段、原人物、原物和旧马伦结局完全不改，不重新初始化，不伪造教会身份。';
