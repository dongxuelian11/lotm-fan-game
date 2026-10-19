import { OCEAN_SINGER_GUIDE } from '../ocean-singer/content.js';
import type { CataclysmPriestAbilityId } from './types.js';

/** Novel-supported ability/ritual limits; all arrangements, originals and numerical rules are G. */
export const CATACLYSM_PRIEST_GUIDE = OCEAN_SINGER_GUIDE;
export const CATACLYSM_PRIEST_PRICES = { guidance: 520, potion: 7200, labourCredit: 6300 } as const;
export const CATACLYSM_PRIEST_MIN_OCEAN_SINGER_WEEKS = 12;
export const CATACLYSM_PRIEST_LABOUR_STEPS = 5;
export const CATACLYSM_PRIEST_BOTTLE_IDS = ['cataclysm-priest-potion-1', 'cataclysm-priest-potion-2', 'cataclysm-priest-potion-3'] as const;
export const CATACLYSM_PRIEST_FORMULA_STATUS = '灾难主祭完整配方、材料与用量、完整仪式布置、规模与时长尚未核实，保持未知。艾洛只介绍独立序列4成品原瓶；不把海洋歌者原瓶、原海怪或护膜当成本阶材料。已核仪式边界为引发地震与海啸，在其中服药并撑到结束；持有原瓶或服药成功均不单独完成晋升。';
export const CATACLYSM_PRIEST_RITUAL_SOURCE = '第四部83章《复盘》给出地震、海啸环境中服药并撑到结束的边界。以下为原创G有限安排：61岁成年女性灾难主祭阿尔玛·伦恩与44岁奥林·戴尔、39岁梅布尔·基恩，在贝克兰德外持照无人海湾亲自准备独立原场地与原包。预约420便士和1行动，下一真实周本人花1行动沿原路到平台；人员实际退至高脊，明确核验并确认引发地震。原潮尺破裂、原下步道损坏，真实海水先退再涌。独立确认服药后，须两次各60秒的真实危险阶段直到退潮；原环境损伤不撤销。人员、许可、位置、数值与时序均G，不是完整原著布置或现实防灾指导。';
export const CATACLYSM_PRIEST_SOURCE_STATUS = '暴君途径序列4灾难主祭可用龙卷卷起实际海水、操纵强浪与闪电攻击（第六部78章《祝愿》）。强浪可以掀船，攻击仍可失败或被抵抗，同伴与环境不会自动免伤。本作只实现有实际海水的有限岸边效果，保留水手、暴怒之民、航海家、风眷者、海洋歌者全部原ID、原掌握、原兽原船员与过去经历。海王3的遥距影响海域以及海神权杖权能不下放；不凭空造海或开放全图灾害。所有距离、消耗、判定与新人物原物为原创G。';
export const CATACLYSM_PRIEST_POTION_SOURCES = CATACLYSM_PRIEST_BOTTLE_IDS.map((id, index) => ({ id, source: `${CATACLYSM_PRIEST_GUIDE}的独立灾难主祭成品交接渠道实际封存第${index + 1}瓶序列4原瓶${id}；供给为原创G，非水手至海洋歌者旧瓶改装。完整配方未知，仍须独立原场地、实际地震海啸与撑至结束。` }));
export const CATACLYSM_PRIEST_LABOUR_TASKS = ['核对本瓶独立封签', '清点本瓶原运输箱', '整理本瓶交接凭据', '核验本瓶原供应记录', '完成本瓶封存记录复核'] as const;
export const CATACLYSM_PRIEST_ABILITIES: { id: CataclysmPriestAbilityId; label: string; description: string }[] = [
  { id: 'tyrant.s4.sea-tornado', label: '海水龙卷', description: '以风卷起现场实际海水形成有限龙卷；不能在内陆凭空造海，同伴与原物不自动免伤。原创G岸边练习与战斗限定真实水源，效果会结束，已移动或损坏的原物不复原。' },
  { id: 'tyrant.s4.surge-control', label: '有限强浪', description: '操纵实际近岸水体形成有限涌浪，可以移动原浮具或在真实战斗中冲击目标。没有远距全海控制、无穷水源或自动友军排除；停止效果不重置原物位置。' },
  { id: 'tyrant.s4.great-lightning', label: '强力闪电', description: '对现场明确目标施加实际闪电攻击，可失败、受抵抗或造成真实伤害。原创G练习只作用原空岸石靶并留下焦痕，不凭空改写气象，不附带无限范围或必杀。' },
];
export const CATACLYSM_PRIEST_CONSUMPTION_RISK = '原创G：海洋歌者消化100、晋升后满12整周，健康>20、精神>40；本人在本周新原平台，工作人员已实际撤离并确认引发真实地震海啸后，独立确认饮一原瓶，0行动、意志28。四档均耗原瓶与原包：大成功精神−8；成功精神−15；失败健康−15、精神−25、排异+30；灾难健康−25、精神−45、排异+60。药物排异仅保底1，之后海浪可真实致死。服药成功只是暂定，仍为5；两次持守各真实60秒、各体质16，伤害0/4/12/25，撑到退潮才完成4。中途可沿仍通畅上侧回阶步行撤至高脊，保持5与旧消化100，原瓶、费用、原包和损伤不返还；海潮继续实际结束。完成后四属性各+1、三项新掌握0、旧掌握不变、扮演0、灵性上限120不补当前值、身体性别不变。';
