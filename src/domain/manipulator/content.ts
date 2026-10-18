import { DREAMWALKER_GUIDE } from '../dreamwalker/content.js';
import type { ManipulatorAbilityId, ManipulatorDonorId } from './types.js';

export const MANIPULATOR_GUIDE = DREAMWALKER_GUIDE;
export const MANIPULATOR_PRICES = { guidance: 520, materials: 6500, labourCredit: 5600, gathering: 240 } as const;
export const MANIPULATOR_MIN_DREAMWALKER_WEEKS = 12;
export const MANIPULATOR_LABOUR_STEPS = 5;
export const MANIPULATOR_BATCH_IDS = ['manipulator-batch-1', 'manipulator-batch-2', 'manipulator-batch-3'] as const;
export const MANIPULATOR_FORMULA = [
  { name: '树人导师的结晶之心', quantity: 1, unit: '颗' },
  { name: '老年心灵巨龙的血液', quantity: 80, unit: '毫升' },
  { name: '树人导师的金色树叶', quantity: 3, unit: '片' },
  { name: '七名不同人类或类人生物在强烈情绪中的泪水', quantity: 7, unit: '人各1滴' },
] as const;
export const MANIPULATOR_FORMULA_ALTERNATIVES = '原著主材三选一：老年心灵巨龙的完整大脑、树人导师的结晶之心，或操纵师非凡特性。本阶段只开放结晶之心渠道；另外两项准确列出但不可购买，不另编重量。辅材为老年心灵巨龙血液80毫升、树人导师金色树叶3片，以及七名不同人类或类人生物强烈情绪的泪水各1滴；没有纯水。';
export const MANIPULATOR_FORMULA_STATUS = '第五部107《会长》已核完整主辅材料与至少万人情绪共鸣仪式。材料与数量是虚构世界物品，不是现实制药说明；具体调配先后未核，不编造配制步骤。购买只交付结晶之心、龙血、金叶三组原材料，七滴自愿泪水须逐人实际取得。';
export const MANIPULATOR_RITUAL_SOURCE = '原著要求在特定场合使至少一万人产生强烈情绪共鸣，并在其中饮用魔药。本作G以四个不同城区成年代表团的自愿纪念与互助集会实现；每团登记3000不等于实际在场，须下一真实周赴原礼堂、逐团实际入场、共同情绪窗口成立。不能买名册、读取旧人数或暗中操纵群众替代仪式。';
export const MANIPULATOR_SOURCE_STATUS = '第六部40《共鸣》已核：心智体可经集体潜意识海接触心灵岛屿，读取念头、影响潜意识；虚拟人格有自己的心智体，可并行精神任务；精神瘟疫可在精神层面传播。原著奥黛丽当时13个人格是她的实例，不是初晋免费库存。较强精神防御会拒绝或反制，撤回人格不会抹掉已种瘟疫，虚拟人格不等于精神全免。龙化需要适应和正确暗示，本阶段尚不可玩；织梦人3的身份分割与近真幻象未提前授予。人物、供给、次数、成本、判定和有限场景均为原创G。';
export const MANIPULATOR_LABOUR_TASKS = ['核对本批结晶之心的原封签', '整理本批龙血交接凭据', '逐片清点本批三片原金叶', '核查本批独立运输箱与收货记录', '复核本批三组原材料的来源'] as const;
export const MANIPULATOR_DONORS: { id: ManipulatorDonorId; name: string; age: number; location: string; emotion: string; story: string }[] = [
  { id: 'MP4-D1', name: '艾琳', age: 34, location: '北区互助会原缝纫室', emotion: '失而复得的喜悦', story: '艾琳亲手修补并重新展出母亲留下的旧围巾；在这次实际会面中，她讲述修补进展，因保存下来的共同记忆落泪。' },
  { id: 'MP4-D2', name: '托马', age: 46, location: '东区原木工室', emotion: '对逝去同伴的思念', story: '托马在原木工室为已故成年同伴制作纪念木牌；这次实际会面时，他在新刻下的名字前表达思念。' },
  { id: 'MP4-D3', name: '瑟拉', age: 29, location: '南区互助会原阅览室', emotion: '重拾生活的感激', story: '瑟拉在本次互助回访中读出自己新写的谢辞，感谢成年邻居陪她重开旧书摊；眼前的亲笔新页让她激动落泪。' },
  { id: 'MP4-D4', name: '伯恩', age: 52, location: '西区原面包坊会客间', emotion: '久别重逢的喜悦', story: '伯恩在本次会面中读到远行成年兄长新寄来的近况，谈起两人重聚后的日常，由真实的思念与喜悦流泪。' },
  { id: 'MP4-D5', name: '诺拉', age: 38, location: '北区原花房', emotion: '纪念亲人的悲伤', story: '诺拉亲自在原花房为已故成年姐姐整理新一束纪念花；这次实际整理和讲述唤起她的悲伤，而非外人施加暗示。' },
  { id: 'MP4-D6', name: '盖文', age: 41, location: '东区原修表铺会客间', emotion: '完成承诺的释然', story: '盖文在本次回访中核对自己刚完成的一页修理承诺，想起曾鼓励他的成年师父；履约后的释然让他眼眶湿润。' },
  { id: 'MP4-D7', name: '莉娜', age: 26, location: '南区原成人合唱排练室', emotion: '共同互助的感动', story: '莉娜在本次成人合唱排练后讲述当天伙伴互助的实际经过；她为一起完成的纪念歌感动落泪。' },
];
export const MANIPULATOR_ABILITIES: { id: ManipulatorAbilityId; label: string; description: string }[] = [
  { id: 'audience.s4.mind-island', label: '心灵岛屿接触', description: '以心智体有限接触真实目标的心灵岛屿；本阶段和平练习须成人当前自愿，取得线索仍要现实复核，精神防御可拒绝。不是全知、自动供词或万能控制。' },
  { id: 'audience.s4.virtual-persona', label: '虚拟人格', description: '从本人实际分出有限虚拟人格，承担有界精神任务和部分精神防护，付出灵性与精神成本后须主动收回。没有肉身复制、免费13人库存或所有精神侵蚀免疫。' },
  { id: 'audience.s4.mental-plague', label: '精神瘟疫', description: '可在精神层面种下并发展真实精神瘟疫；本阶段和平练习只有无生命普通图示，真实作用限可选冲突中的原目标。离场或撤回人格不会治愈已种瘟疫，不能默认他人免疫。' },
];
export const MANIPULATOR_CONSUMPTION_RISK = '以下数值均为本作G：梦境行者消化100、晋升后满12整周、健康>20且精神>40，并在当前实际至少10000人同地共鸣窗口中才可0行动独立确认饮药。意志难度28，必耗该原瓶并散场。大成功：晋升、精神−8；成功：晋升、精神−15；失败：健康−15、精神−25、排异+30；灾难：健康−25、精神−45、排异+60。现场监督仅对此次药物排异将健康与精神保底到1，不保护实际战斗。失败仍为梦境行者，必须用另一原瓶和下一真实周的新集会重试。成功四属性各+1，旧掌握完整保留，三项新掌握从0开始；灵性上限120，当前不补满。';
