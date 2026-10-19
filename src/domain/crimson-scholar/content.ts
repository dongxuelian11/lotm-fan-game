import { POTION_PROFESSOR_GUIDE } from '../potion-professor/content.js';
import type { CrimsonScholarAbilityId } from './types.js';
export { CRIMSON_SCHOLAR_CASE_IDS } from './types.js';

/** Book 5 chapter 63. Prices, timing, bounded scenes and exact numerical rules below are original G. */
export const CRIMSON_SCHOLAR_GUIDE = POTION_PROFESSOR_GUIDE;
export const CRIMSON_SCHOLAR_PRICES = { guidance: 460, potion: 4800, labourCredit: 4200 } as const;
export const CRIMSON_SCHOLAR_RITUAL_KIT_PRICE = 150;
export const CRIMSON_SCHOLAR_MIN_POTION_PROFESSOR_WEEKS = 12;
export const CRIMSON_SCHOLAR_LABOUR_STEPS = 5;
export const CRIMSON_SCHOLAR_BOTTLE_IDS = ['crimson-scholar-potion-1', 'crimson-scholar-potion-2', 'crimson-scholar-potion-3'] as const;
export const CRIMSON_SCHOLAR_SOURCE_STATUS = '第五部第63章支持序列5深红学者制造区域满月或隐藏月亮，以及月光闪现、身体月光化与重组；实际强度取决于知识。区域效果不改变真实天体，也不能替代晋升所需的真实满月照耀。保留药师、驯兽师、吸血鬼、魔药教授全部原ID、原掌握和原身体、血食及药剂限制；只新增三项深红学者能力。导师仍为已认识的成年艾琳，晋升不自动授予组织身份。具体范围、代价、判定、短时场域、路线和复核、成年角色、指导成品、封装仪式材料包与有限月相事件、价格和成熟周数均为原创G，不冒充原著精确公式，也不提前取得序列4能力。';
export const CRIMSON_SCHOLAR_FORMULA_STATUS = '深红学者完整晋升配方仍未知，指导不解锁配方采购或晋升魔药制造；目前只交付本作原创G渠道实际供应的序列5独立成品原瓶。已知仪式需要真实满月照耀，并使用代表不同月相的金属、宝石与非人幻想生物的非凡血液；具体清单、用量和配制顺序未核实，不编造完整配方。';
export const CRIMSON_SCHOLAR_RITUAL_KIT_SOURCE = '艾琳从本作原创G独立仪式供给渠道带到原夜间药房露天屋顶的封装材料包：包内有代表月相的金属、宝石与非人幻想生物的非凡血液，仅供本次真实满月下的虚构仪式。未公开具体清单、用量或操作配方，不涉及人血或现实取材。BEGIN_RITUAL实际拆封、准备并耗尽本包；即使未服药就退出也不退款、不恢复材料。';
export const CRIMSON_SCHOLAR_POTION_SOURCES = CRIMSON_SCHOLAR_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${CRIMSON_SCHOLAR_GUIDE}从独立深红学者成品交接渠道实际取得的第${index + 1}瓶序列5深红学者成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非药师、驯兽师、吸血鬼或魔药教授旧瓶改装，未声称掌握完整配方。`,
}));
export const CRIMSON_SCHOLAR_LABOUR_TASKS = ['核验本瓶独立封签', '整理原药房普通存放格', '校对原瓶供货记录', '核对本瓶交接凭据', '完成本瓶独立入库复核'] as const;
export const CRIMSON_SCHOLAR_ABILITIES: { id: CrimsonScholarAbilityId; label: string; description: string }[] = [
  { id: 'moon.s5.regional-moon', label: '区域月相', description: '在有限区域制造满月效果或隐藏月亮，强度依赖知识；实际消耗、范围与短时边界为原创G。不能改变真实天体，不能拿自己制造的区域满月代替晋升仪式所需的真实满月。' },
  { id: 'moon.s5.moonlight-step', label: '月光闪现', description: '将自身短时月光化，在实际核对的有限月光路线中闪现；需真实成本和可行目的地，失败照耗。不能跳过路线、穿过任意障碍或无限传送，具体判定与范围是原创G。' },
  { id: 'moon.s5.moonlight-reassembly', label: '月光重组', description: '自身月光化后实际重组原身体，力量受知识影响；实付灵性、恢复有限。不能复制身体、复活死者、抹去失败与材料成本，具体恢复量和时机为原创G。' },
];
export const CRIMSON_SCHOLAR_CONSUMPTION_RISK = '以下时间、代价与判定均为原创G：魔药教授消化100且晋升后满12整周；先1行动预约严格未来的已公告满月，公告周1行动和150便士到原露天屋顶，在艾琳本人在场、真实满月实际照耀下耗用唯一封装仪式包。每次到访至多服一瓶，0行动独立确认、意志难度26；服药前健康高于20、精神高于40。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。导师仅处理本次指导服药的排异，不随机即死，不能保护战斗或其它危险。失败保留魔药教授消化及全部原掌握；成功新增三项0掌握，四属性各+1，灵性上限100但当前灵性不补满。服药后或提前放弃均须0行动实际退出；材料和药瓶不恢复，下次仪式必须另约未来事件。尚未开始的预约可0行动取消，已发布满月日期不变。';
