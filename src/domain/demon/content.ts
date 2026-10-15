import { SERIAL_KILLER_GUIDE } from '../serial-killer/content.js';
import type { DemonAbilityId } from './types.js';
export { DEMON_CASE_IDS } from './types.js';

export const DEMON_GUIDE = SERIAL_KILLER_GUIDE;
export const DEMON_PRICES = { guidance: 360, potion: 3320, labourCredit: 3000 } as const;
export const DEMON_MIN_SERIAL_KILLER_WEEKS = 12;
export const DEMON_LABOUR_STEPS = 5;
export const DEMON_BOTTLE_IDS = ['demon-potion-1', 'demon-potion-2', 'demon-potion-3'] as const;
export const DEMON_SOURCE_STATUS = '第二部第98章（核验定位L56162–L56192）支持不同恶魔存在类型差异；危险预感只针对近期会造成致命伤害、且对方已经付诸实际行动的威胁，可以指向方向、人物或地点，不能直接知道完整计划。第二部第202、206章表明仍须调查核实，第187章表明这种预感可受反制，绝非全知或绝对安全。恶魔化可暂时增大本人身体，提升力量、速度与坚硬皮肤的有限防护，抵抗多数毒素及有限火焰、诅咒，不等于全面免疫。第109章支持火焰与污秽魔法，仍可被抵抗或替代。欲望与恶意失控风险、此前丧失原有良知的事实继续存在。当前新增危险预感、恶魔化身体、有限火焰诅咒三项掌握；没有序列5欲望控制、远程情绪操纵或读取秘密。原低序列ID与掌握完整继承。罗安、供给、仓库现场、练习与数值均为本作原创G；三项非伤害性实践与反思可得和平100是有成本的游戏替代，不是原著保证的无代价安全消化法。';
export const DEMON_FORMULA_STATUS = '深渊途径序列6恶魔的完整晋升配方尚未核实；用药指导只说明本作原创G渠道实际供应的独立序列6成品原瓶，不解锁配方、原料采购或魔药制造，不编造材料。';
export const DEMON_POTION_SOURCES = DEMON_BOTTLE_IDS.map((id, index) => ({
  id, source: `${DEMON_GUIDE}经独立恶魔成品交接渠道实际取得的第${index + 1}瓶序列6恶魔成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非罪犯、折翼天使或连环杀手旧瓶改装，未声称掌握完整配方。`,
}));
export const DEMON_LABOUR_TASKS = ['核对本瓶独立封签', '整理原旧货库普通存放格', '清点原练习台普通器具', '校对本瓶交接日期', '完成本瓶供货凭据复核'] as const;
export const DEMON_ABILITIES: { id: DemonAbilityId; label: string; description: string }[] = [
  { id: 'abyss.s6.danger-premonition', label: '有限危险预感', description: '仅当对方已经付诸实际行动、形成近期致命威胁时，才可能预感有限方向、人物或地点；不直接获得计划细节，仍须普通调查，可受反制。普通争执或菜单上的未来敌人不自动满足条件。' },
  { id: 'abyss.s6.demonic-body', label: '暂时恶魔化身体', description: '本人暂时增大，力量、速度与硬皮有限增强；多数毒素及部分火焰诅咒抵抗并非全部免疫。增大的本人不能穿过未改变的窄门，结束练习须实际恢复正常，不治疗或改变别人身体。' },
  { id: 'abyss.s6.flame-hex', label: '有限火焰与诅咒', description: '针对眼前明确目标的有限火焰或污秽魔法，可被抵抗或以其它手段应对。此处仅在清空的原石火盆测试有限自生火焰，须用现场原盖实际熄灭，不能远程控制情绪、任意点燃建筑或读取秘密。' },
];
export const DEMON_CONSUMPTION_RISK = '以下时间、代价与判定均为原创G：服药必耗本次选定原瓶，0行动，意志难度24；连环杀手消化100且晋升后满12整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。罗安在场处理本次指导服药的排异，不随机即死；休养可恢复，原瓶不会复原。保护不适用于战斗与其它危险。失败保留连环杀手消化与全部原掌握；成功只新增三项恶魔掌握，从0开始，四属性各+1，灵性上限80但当前灵性不补满。良知不恢复、恶欲风险不消失；G和平路线不是原著无代价安全保证。';
