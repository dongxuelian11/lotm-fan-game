import { BIOLOGIST_GUIDE } from '../biologist/content.js';
import type { DruidAbilityId, DruidStudySourceId } from './types.js';
export { DRUID_CASE_IDS, DRUID_STUDY_SOURCE_IDS } from './types.js';

export const DRUID_GUIDE = BIOLOGIST_GUIDE;
export const DRUID_PRICES = { guidance: 460, potion: 4800, labourCredit: 4200, rite: 90 } as const;
export const DRUID_MIN_BIOLOGIST_WEEKS = 12;
export const DRUID_LABOUR_STEPS = 5;
export const DRUID_BOTTLE_IDS = ['druid-potion-1', 'druid-potion-2', 'druid-potion-3'] as const;
export const DRUID_NOTEBOOK_ID = 'DR5-NOTEBOOK-1';
export const DRUID_FORMULA_STATUS = '母亲途径序列5德鲁伊的完整配方与完整晋升仪式细节尚未核实。已核实的仪式部分要求了解许多普通动物和三种超凡生物的习性、身体构造，并实际写下积累的知识与经验；不能因其余细节未知就省略仪式。独立成品原瓶与剩余指导安排为本作原创G，不解锁配方、原料采购或魔药制造。';
export const DRUID_SOURCE_STATUS = '序列5德鲁伊已有地下潜行原文依据，表现为脚下土壤软化、本人潜入后土壤恢复；原文没有给出本作距离、速度、代价或全部适用地面。这里只有已知普通壤土内的一段实际身体通行，所有场地、范围和费用均为原创G。四项资料研习把已核实的晋升知识与书写要求变为实际行动；犬、猫、鼠三种普通动物的具体选择与教学记录均为G，不声称原文规定普通动物精确数量。三种超凡生物分别为拉瓦章鱼、成年霍纳奇斯灰山羊、六翼石像鬼，名字有原著依据，原资料柜及其合法借抄的田野记录和构造图版是G，不补写未核原著解剖细节。没有提供动物变形菜单，没有取得序列4的赋灵创造。伊芙·莫兰、同一原苗圃训练园、原标记片、原苗、原册、成年马伦争议与独立成品渠道均为G；全部旧能力、原物、伤势、失败和历史保留，不授予组织身份。';
export const DRUID_STUDY_SOURCES: { id: DruidStudySourceId; title: string; referenceId: string; creatures: string[]; source: string }[] = [
  { id: 'ordinary-animals', title: '普通动物习性与构造', referenceId: 'DR5-REF-ORDINARY', creatures: ['犬', '猫', '鼠'], source: '伊芙原资料柜DR5-REF-ORDINARY：合法借抄的犬、猫、鼠普通田野记录与构造图版，三种是本作G的具体教学选择。实际打开研读同一册，与导师比较记录中的习性与身体构造，写自己的简短笔记，再原位归还；不接触活体。' },
  { id: 'lava-octopus', title: '拉瓦章鱼资料研习', referenceId: 'DR5-REF-LAVA', creatures: ['拉瓦章鱼'], source: '伊芙原资料柜DR5-REF-LAVA：合法借抄的拉瓦章鱼田野记录与构造图版。该物种名称有原著依据，教学册来源、图版与学习安排为G；只研读眼前已有资料并写自己的笔记，不声称看见活体或取得未核原著知识。原册当次归还。' },
  { id: 'grey-goat', title: '成年霍纳奇斯灰山羊资料研习', referenceId: 'DR5-REF-GOAT', creatures: ['成年霍纳奇斯灰山羊'], source: '伊芙原资料柜DR5-REF-GOAT：合法借抄的成年霍纳奇斯灰山羊田野记录与构造图版。独立于章鱼的第二种超凡生物；名称有原著依据，资料来源和教学安排为G。实际研读、比较习性与构造、写自己的笔记，当次归还原册。' },
  { id: 'six-winged-gargoyle', title: '六翼石像鬼资料研习', referenceId: 'DR5-REF-GARGOYLE', creatures: ['六翼石像鬼'], source: '伊芙原资料柜DR5-REF-GARGOYLE：合法借抄的六翼石像鬼田野记录与构造图版。独立于章鱼与灰山羊的第三种超凡生物；名称有原著依据，资料来源和教学安排为G。实际研读、比较习性与构造、写自己的笔记，当次归还原册。' },
];
export const DRUID_POTION_SOURCES = DRUID_BOTTLE_IDS.map((id, index) => ({ id, source: `${DRUID_GUIDE}经独立德鲁伊成品交接渠道实际取得的第${index + 1}瓶序列5德鲁伊成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非耕种者、医师、丰收祭司或生物学家旧瓶改装，不声称已知完整配方或完整仪式。` }));
export const DRUID_LABOUR_TASKS = ['核对本瓶独立封签', '整理原苗圃普通资料柜', '核查原园地标记清单', '校对本瓶交接日期', '完成本瓶供货凭据复核'] as const;
export const DRUID_ABILITIES: { id: DruidAbilityId; label: string; description: string }[] = [
  { id: 'mother.s5.ground-passage', label: '地下潜行', description: '已核实德鲁伊可使脚下地面软化、本人潜入并恢复地面。这里仅在明确已知的普通浅层壤土内实际移动同一身体，有限距离与3灵性费用为G；训练去程1米、返程另付3灵性，可失败，始终另有原普通地表路实际步行退出。不穿金属、地基或未知地层，不埋敌、不远程手、不无敌驻地下；没有动物变形或高阶赋灵。' },
];
export const DRUID_CONSUMPTION_RISK = '以下数值均为原创G：须生物学家消化100、晋升后满12整周、健康高于20且精神高于40；四项实际资料研习与原册书写完成后，每次服药前另付1行动和90便士准备本次仪式，失败后也不能重复使用准备。选定原瓶服药必耗，0行动，意志难度26。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。伊芙在场处理本次排异，未随机即死；不保护战斗与其它危险。失败保留原研习、原册、消化与掌握，重试必须另取原瓶并重新付费准备。成功只新增地下潜行，从0掌握开始，四属性各+1，灵性上限100但当前灵性不补满。';
