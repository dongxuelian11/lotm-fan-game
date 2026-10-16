import { SAGE_ABILITIES, SAGE_INHERITED_ABILITIES } from '../sage/content.js';
import type { KnowledgeEmperorAbilityId, KnowledgeEmperorPreparationId, KnowledgeEmperorPrices } from './types.js';

/** Canonical S1 name: L128225/L193726. L229395 supports knowledge-to-power and
 * power-to-knowledge as a direction. The full formula and ritual are unknown.
 * Polluted complete cards are a special Roselle source, not ordinary S1 powers.
 * Every particular technique, object, check, price and number here is bounded
 * original gameplay; no omniscience, free characteristics or artifact ritual. */
export const KNOWLEDGE_EMPEROR_GUIDE = '贝克兰德原档案馆专业交接处';
export const KNOWLEDGE_EMPEROR_PRICES = { guidance: 500, potion: 7200, labourCredit: 6000, labourBalance: 1200, preparation: 180, resupply: 100 } as const;
export const knowledgeEmperorPrices = (): KnowledgeEmperorPrices => KNOWLEDGE_EMPEROR_PRICES;
export const knowledgeEmperorSourceLabel = (): string => `${KNOWLEDGE_EMPEROR_GUIDE}的独立知识皇帝成品渠道`;
export const KNOWLEDGE_EMPEROR_MIN_SAGE_WEEKS = 12;
export const KNOWLEDGE_EMPEROR_LABOUR_STEPS = 5;
export const KNOWLEDGE_EMPEROR_BOTTLE_IDS = ['knowledge-emperor-potion-1', 'knowledge-emperor-potion-2', 'knowledge-emperor-potion-3'] as const;
export const KNOWLEDGE_EMPEROR_POTION_SOURCES = KNOWLEDGE_EMPEROR_BOTTLE_IDS.map(id => ({ id, source: `尚未当面登记来源的知识皇帝独立封存原瓶${id}；原瓶分别交付和耗用。` }));
export const knowledgeEmperorPotionSource = (number: number, week: number): string => `${knowledgeEmperorSourceLabel()}第${Math.ceil(number / 3)}批、第${week}周实际登记的第${number}瓶序列1成品，独立封存编号knowledge-emperor-potion-${number}；本瓶独立劳动、交付与耗用，不补回旧瓶。`;
export const KNOWLEDGE_EMPEROR_FORMULA_STATUS = '交接处只交付独立封存的知识皇帝成品，不提供可自行调配的完整配方。先核对窥秘人至贤者的八阶真实经历与当前凭据，复核知识和实际力量的有限往返，走查停止与普通返程。三项专业准备完成后，还须检查本周服药场地，再独立确认饮用所选原瓶。';
export const KNOWLEDGE_EMPEROR_SOURCE_STATUS = '继续使用原档案馆、艾瑞丝·沃德和同一原档页。馆外至门口2米，门口至A位6米，A至B位4米。三次实践各重新征得可撤回许可，实际购买一张纸，亲手阅读、抄录和携回。已封存的玻璃名录灾难不重启，旧伤者不会因晋升痊愈。知识赋力须实际应用，循力求知须先有真实付费力量及可见反应；缺失文字始终未知。';
export const KNOWLEDGE_EMPEROR_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const KNOWLEDGE_EMPEROR_PREPARATIONS: { id: KnowledgeEmperorPreparationId; title: string; description: string }[] = [
  { id: 'VERIFY_ORIGINALS', title: '核对八阶经历与同一原物', description: '逐一核对八阶真实晋升、失败原瓶、贤者三份报告与反思，以及同一原档页、原记录、导管和已耗用材料。旧灾难封存、成年伤者伤势和梅林撤退结果全部留存。' },
  { id: 'VERIFY_KNOWLEDGE', title: '复核已知内容与实际力量来源', description: '分别核对本人实际知道的内容和已付费施加的有限力量。短窗只作用于同一可见来源，不恢复资源，不补出缺失原文，不揭示他人内心，也不保证所有检定成功。' },
  { id: 'CHECK_RETURN', title: '走查停止、归物与普通返程', description: '亲自核对撤回许可、停止短窗、归还同一纸页和普通步行返程。已用成本不能退还；服药支持只处理本次排异，不治疗本人或旧人的既有伤势。' },
];
export const KNOWLEDGE_EMPEROR_ABILITIES: { id: KnowledgeEmperorAbilityId; label: string; description: string }[] = [
  { id: 'hermit.s1.knowledge-power', label: '知识赋力', description: '支付8灵性与2精神，知识18。用本人实际阅读抄录的同一已知内容开启20秒一次窗口；还须对同一原页实际应用并消耗一份纸页载荷，有限稳定度从3改善到6。实战只为下一次同位置可见对象的实际普通攻击增加35，应用才磨损原纸；移动、遮挡、到期或撤回使窗口失效。' },
  { id: 'hermit.s1.power-knowledge', label: '循力求知', description: '先以4灵性和同一纸页的一次载荷实际推动原页，再支付8灵性与2精神、知识18检定，开启20秒核验窗口。核验只得纸缘位移与阻力线索，缺失文字仍未知。实战须有20秒内可见的敌方实际力量支出凭据，只将下一次同类实际冲击减少30；不返还力量或纸页载荷。' },
];
export const KNOWLEDGE_EMPEROR_INHERITED_ABILITIES = [...SAGE_INHERITED_ABILITIES, ...SAGE_ABILITIES];
export function knowledgeEmperorConsumptionRisk(): string {
  return '贤者消化100、实际晋2后12整周、三份旧报告与反思完成、健康>20且精神>40。三项专业准备各1行动，再实付1行动与180便士检查本周服药场地；0行动独立确认饮用所选原瓶，意志30。大成功：晋1、精神−8；成功：晋1、精神−15；失败：仍2、健康−15精神−25排异+30；严重排异：仍2、健康−25精神−45排异+60。原瓶与当次准备均耗尽，专业支持只将本次排异后的健康精神保底到1。成功四属性各+1，13项原掌握不变，两项新掌握从0开始；灵性上限120，当前不补满。姓名、性别、身体、旧伤与既有性格保留。全批失败耗尽后，实付1行动与100便士申请独立三瓶，至少跨一真实周领取；每瓶另做五次劳动并付1200便士，或直接支付7200便士。';
}
export const KNOWLEDGE_EMPEROR_CONSUMPTION_RISK = knowledgeEmperorConsumptionRisk();
