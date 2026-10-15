import type { AttendantMysteriesAbilityId } from './types.js';
/** Source: uploaded novel VII25 L226427–439; town interaction L232825–869;
 * ascension L237568–582; abilities VIII3 L238419–425, positioning L239145–149.
 * The nine named supplier samples, quantities, town roster/24 roles/12-week proof,
 * prices, limits and all numerical checks are original bounded game design.
 * No source-castle shortcut, existing-city takeover, star weapon or free revival. */
export const ATTENDANT_MYSTERIES_GUIDE = '当代灵界档案员阿德里安·维尔';
export const ATTENDANT_MYSTERIES_PRICES = { guidance: 500, materials: 9000, labourBalance: 900, brew: 120, prepare: 140, resupply: 120 } as const;
export const ATTENDANT_MYSTERIES_LABOUR_STEPS = 5;
export const ATTENDANT_MYSTERIES_FORMULA = [
  { id: 'characteristic', name: '诡秘侍者非凡特性', quantity: 1, unit: '份', note: '独立封存遗产，须核对原封来源。' },
  ...['雾色石屑', '回声树脂', '银纹枯叶', '沉光粉尘', '无风花绒', '镜泽水晶', '幽潮盐粒', '空铃果壳', '星灰砂'].map((name, i) => ({ id: `spirit-specialty-${i + 1}`, name: `灵界特产·${name}`, quantity: 1, unit: '封', note: '本批实际取得的九种不同辅料之一，封存后单独交付。' })),
] as const;
export const ATTENDANT_MYSTERIES_STORY = '建立一座由秘偶生活的全新城镇。每一个居民必须来自实际控制的原生物，转化不可逆；居民互相供货、往来、照护、工作与写信，各自经历改变后续生活。外来商人和信使仍是有自主意志的成年人。城镇与外界产生真实往来，并形成对应的灵界区域后，才能在镇内准备服药。';
export const ATTENDANT_MYSTERIES_BOUNDARY = '本地方案使用24个居民岗位、6座设施与至少12个实际生活周。仅有数量或周数不能代替居民互动和外界联系。迁址会使旧往来失去本次仪式效力，既有死者、物资支出和旧灵界区域仍保留。可以停留奇迹师，也可从原路离开；所有原身体与分出的灵之虫继续受实际距离和容量限制。';
export const ATTENDANT_MYSTERIES_RISK = '奇迹师消化100、旧实践已收束，健康>20、精神>40；真实新镇灵界区域当前可用。须在镇内为选定原瓶付1行动和140便士检查，独立确认服药。意志难度30：成功晋升且精神−15，大成功精神−8；失败耗原瓶，健康−15、精神−25、排异+30，严重失败健康−25、精神−45、排异+60。现场支持只将本次药物排异的健康和精神保至1。原城镇与失败事实保留，重新筹药和核证后可再准备。成功四属性各+1，旧31项掌握与四次复起账本原样保留，三项新掌握从0开始；当前生命与灵性不补满。';
export const ATTENDANT_MYSTERIES_ABILITIES: { id: AttendantMysteriesAbilityId; label: string; description: string }[] = [
  { id: 'diviner.s1.thread-regeneration', label: '灵体之线再生', description: '只唤回同一实际材料过去具有而已消失的灵体之线。工房里以购入的鱼类遗骸作有限练习，遗骸不会恢复生物生命；金属、金币和旧终档人物不能因此凭空获得线或复活。' },
  { id: 'diviner.s1.bounded-grafting', label: '有限嫁接', description: '先实地核定两个实际端点，再暂时改变它们的连接。本人和携带原物只发生一次连续移动，费用、距离与原出口有效；没有未知地点定位或恒星伤害。' },
  { id: 'diviner.s1.mysterious-realm', label: '诡秘之境', description: '在有限原房形成短时隐秘环境，原人原物仍在其中，停止后仍在实际位置。进入、离开、维持和反制都有条件，不是无敌屏障或永久删除事物。' },
];
