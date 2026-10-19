import { ASTRONOMER_GUIDE } from '../astronomer/content.js';
import type { AlchemistAbilityId } from './types.js';

export const ALCHEMIST_GUIDE = ASTRONOMER_GUIDE;
export const ALCHEMIST_PRICES = { guidance: 520, potion: 7200, labourCredit: 6300 } as const;
export const ALCHEMIST_MIN_ASTRONOMER_WEEKS = 12;
export const ALCHEMIST_LABOUR_STEPS = 5;
export const ALCHEMIST_BOTTLE_IDS = ['alchemist-potion-1', 'alchemist-potion-2', 'alchemist-potion-3'] as const;
export const ALCHEMIST_FORMULA_STATUS = '炼金术士的完整配方、材料用量与调配步骤尚未核实，保持未知。埃德温·沃德仅提供本作原创G渠道实际取得的独立成品原瓶，不开放臆造材料、调配或自制药。仪式特征已知、完整条件待核；本作导师方案G不能冒充完整原著仪式。';
export const ALCHEMIST_RITUAL_SOURCE = '第二部249《什么是奇迹》已核到仪式会抽取一定区域内全部生命力，造成土壤沙化、湖泊干涸；具体范围、门槛和完整步骤未核。本作导师方案G限玩家另行付费取得的封闭研究园：原活植物、活土与水体会在独立确认后实际损毁。买空地、旧枯地或仅登记抽取不能替代；用药失败仍留下死亡植物、沙土和干池，下次须另买独立活园、实际投入并等待下一真实周。玩家可放弃并保持天文学家，不涉及人或动物献祭，也不是现实伤害操作说明。';
export const ALCHEMIST_SOURCE_STATUS = '第二部249《什么是奇迹》支持通识者途径序列4炼金术士为自己制造的物品注入“灵魂”、给予一定生命；高达是罗塞尔的未来设想，并非初晋免费能力。灵魂性质、寿命、容量和成本未核；本阶段只实现明确原创G的近距、有限充能、低强度自制造物及指挥，不制造永恒独立灵魂、复制人物或无限队友。耕种者序列4古代炼金师属于另一条途径。奥秘学者3只作跨段身份推定提示，本阶段不授予任何序列3能力。所有供给、价格、时间、尺寸、代价、判定与场景均为原创G。';
export const ALCHEMIST_POTION_SOURCES = ALCHEMIST_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${ALCHEMIST_GUIDE}的独立炼金术士成品交接渠道实际封存第${index + 1}瓶序列4原瓶${id}；供给为原创G，不由通识者至天文学家旧瓶改装。完整配方仍未知，真实活园投入与仪式另行完成。`,
}));
export const ALCHEMIST_LABOUR_TASKS = ['核对本瓶独立封签', '清点本瓶原运输箱', '整理本瓶交接凭据', '核验本瓶原供应记录', '完成本瓶封存记录复核'] as const;
export const ALCHEMIST_ABILITIES: { id: AlchemistAbilityId; label: string; description: string }[] = [
  { id: 'paragon.s4.animate-made-object', label: '自制造物赋予生命', description: '只为本人以实际原材料亲手制造的低强度原物提供有限生命与充能；须实际付出灵性，剩余充能和耐久持续保存。买来的现成物、他人原灯、复制物或无生命账册不能直接赋灵。本阶段范围与成本为原创G。' },
  { id: 'paragon.s4.direct-creation', label: '有限造物指挥', description: '在当前明确近距内，指挥同一件已赋灵、有剩余充能的自制造物执行有限递送或护挡；实际耗费原物充能与本人灵性。停止、耗尽或损坏后效果结束，不增加免费独立队友，不让原物瞬移回手。' },
];
export const ALCHEMIST_CONSUMPTION_RISK = '以下均为本作导师方案G：天文学家消化100、晋升后满12整周、健康>20且精神>40，并在本周亲自在实际抽空生命的原研究园窗口中，独立确认服用自己持有的一瓶。0行动、意志难度28，四档均耗尽原瓶并结束窗口离场。大成功：晋升、精神−8；成功：晋升、精神−15；失败：健康−15、精神−25、排异+30；灾难：健康−25、精神−45、排异+60。导师仅将此次药物排异的健康与精神保底到1，不保护战斗。成功四属性各+1，旧掌握保留，两项新掌握从0，扮演归0，灵性上限120但当前不补满；不改变身体性别。失败仍为天文学家，消化与旧掌握不退，须正常休养；死亡植物、沙土与干池永久保留，另一原瓶必须配合下一处真实投入的新活园。';
