import { ARTISAN_GUIDE } from '../artisan/content.js';
import type { AstronomerAbilityId } from './types.js';
export { ASTRONOMER_CASE_IDS } from './types.js';

/** Book 2 ch.4 establishes new personal combat abilities only. Specific powers remain unverified. */
export const ASTRONOMER_GUIDE = ARTISAN_GUIDE;
export const ASTRONOMER_PRICES = { guidance: 440, potion: 4700, labourCredit: 4100 } as const;
export const ASTRONOMER_MIN_ARTISAN_WEEKS = 12;
export const ASTRONOMER_LABOUR_STEPS = 5;
export const ASTRONOMER_BOTTLE_IDS = ['astronomer-potion-1', 'astronomer-potion-2', 'astronomer-potion-3'] as const;
export const ASTRONOMER_SOURCE_STATUS = '第二部第4章支持序列5天文学家（古称星术师）获得本体实战能力，但该段没有给出具体星术、完整配方或晋升仪式。本阶段唯一新增的“短时专注校准”为明确原创G：消耗有限自身灵性并短时集中注意力，核对眼前实际可见的记录、原仪器或动作，不能从星象获得必然真相，不能发射星光束、控制天气、产生引力或给机器注入灵魂与生命。炼金术士赋灵属于序列4，不提前获得。保留通识者、考古学家、鉴定师与工匠全部原ID和原掌握；原导师埃德温·沃德继续提供渠道，晋升不自动授予组织身份。三项观测练习、原观测台组织与成年角色、有限冲突、成品供给、价格、成熟周数和数值均为原创G。原观测仪器属于原观测台组织，留在原屋顶，不归玩家；工匠原件ART6-LAMP-1仍留在原客户处，不借回、不复制、不当成观测仪器或战斗装备。';
export const ASTRONOMER_FORMULA_STATUS = '天文学家完整配方与晋升仪式尚未核实，材料、用量、调配顺序及仪式要求均保持未知，不能据此断言无需仪式。指导不解锁配方、材料采购或调配；目前仅能取得本作原创G渠道实际供应的序列5独立成品原瓶，指导服药是本阶段G流程。';
export const ASTRONOMER_POTION_SOURCES = ASTRONOMER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${ASTRONOMER_GUIDE}从独立天文学家成品交接渠道实际取得的第${index + 1}瓶序列5天文学家成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非通识者、考古学家、鉴定师或工匠旧瓶改装，未声称掌握完整配方或仪式。`,
}));
export const ASTRONOMER_LABOUR_TASKS = ['核验本瓶封存记录', '核对原工房普通工具目录', '整理公开供货清单', '核查原瓶交接凭据', '完成本瓶供货记录复核'] as const;
export const ASTRONOMER_ABILITIES: { id: AstronomerAbilityId; label: string; description: string }[] = [
  { id: 'paragon.s5.precision-focus', label: '短时专注校准', description: '明确原创G能力：短时集中自身注意力，核对眼前可见的资料、原仪器或动作。实际消耗有限灵性，可能失败；不是已核原著星术，不预言真相，不发射星光、控制天象或赋予机器生命。' },
];
export const ASTRONOMER_CONSUMPTION_RISK = '以下时间、代价与判定均为原创G：服药必耗本次选定原瓶，0行动，意志难度26；服药前健康须高于20、精神须高于40，不足时先休养；工匠消化100且晋升后满12整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。原成年工坊导师在场处理本次指导服药的排异，不随机即死；休养可恢复，原瓶不会复原。保护不适用于战斗或其它危险。失败保留工匠消化及全部原掌握；成功只新增一项0掌握，四属性各+1，灵性上限100但当前灵性不补满。';
