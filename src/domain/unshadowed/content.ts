import { BARD_GUIDE } from '../bard/content.js';
import type { UnshadowedAbilityId } from './types.js';
export const UNSHADOWED_GUIDE = BARD_GUIDE;
export const UNSHADOWED_PRICES = { formula: 520, mainMaterials: 6000, auxiliaryMaterials: 600, labourCredit: 5700, brewing: 100, ritual: 320 } as const;
export const UNSHADOWED_BATCH_IDS = ['unshadowed-batch-1', 'unshadowed-batch-2', 'unshadowed-batch-3'] as const;
export const UNSHADOWED_MIN_PRIEST_OF_LIGHT_WEEKS = 12;
export const UNSHADOWED_LABOUR_STEPS = 5;
export const UNSHADOWED_LABOUR_TASKS = ['核对本批三根原尾羽与原光辉石', '检查本批两项原主材封签', '量记本批四项原辅材', '整理本批六料独立领用记录', '清理本批原调配台'] as const;
/** The available canonical alternative is six actual materials, not a god-blood placeholder. */
export const UNSHADOWED_FORMULA = [
  { id: 'sun-divine-bird-tail-feathers', name: '成年太阳神鸟尾羽', quantity: 3, unit: '根' },
  { id: 'sacred-radiance-stone', name: '神圣光辉石', quantity: 1, unit: '块' },
  { id: 'sun-divine-bird-blood', name: '太阳神鸟血液', quantity: 60, unit: 'mL' },
  { id: 'stone-accompanying-fluid', name: '神圣光辉石伴生液', quantity: 30, unit: 'mL' },
  { id: 'mutated-golden-finger-citron-juice', name: '变异金手柑汁液', quantity: 7, unit: '滴' },
  { id: 'heart-of-magma-powder', name: '岩浆之心粉末', quantity: 10, unit: 'g' },
] as const;
export const UNSHADOWED_FORMULA_SOURCE = '《诡秘之主》第五部第88章《收获》已核：主材可选太阳神血液1滴，或成年太阳神鸟尾羽3根加神圣光辉石1块；四项辅材为太阳神鸟血液60mL、神圣光辉石伴生液30mL、变异金手柑汁液7滴、岩浆之心粉末10g。本渠道只实际供应尾羽与光辉石方案的六项原料；太阳神血液方案仅为已知替代，本处没有神血库存或购入入口。原著材料清单不等于已核投料顺序，具体调配顺序依本作G导师规程。';
export const UNSHADOWED_RITUAL_SOURCE = '原著要求分离自己最强烈、最不愿舍弃的情感，在分离期间服用魔药，并在过程中把该情感回输。不是永久舍弃人性。本作G将当前角色自愿声明的、对长期原导师米瑞尔的珍重与感激绑定为本次具体对象；实际旧指导与已完成经历保留，只有这一份声明情感暂时离身。独立持照专业者西莉娅以本作虚构规程操作同一原封存载体，饮药后再回输同一份情感，非心理医疗说明，也不赋予玩家任意操纵他人情感的能力。';
export const UNSHADOWED_SOURCE_STATUS = '无暗领域中的有限照明与净化不形成实体墙，普通出口可以实际走出；净化可针对普通失控者遗留非凡特性的精神污染，不能保证清除神性或极端污染。析出自身非凡特性可能造成降序列，不是免费的精准洗净。太阳耀斑可能波及友方，必须按当前实际位置核对；无暗十字的固定流血及每小时析出特性是封印物代价，不是无暗者本体固有代价。下一序列3名称为正义导师，当前未取得其能力。全部人员、场地、价格、范围、数值与具体操作为本作G。';
export const UNSHADOWED_CONSUMPTION_RISK = '本作G：光之祭司扮演100，晋升满12整周，健康>20、精神>40；本人在原仪式厅，当前原导师与专业者均自愿在场、声明情感已在本场同一原载体内，才可独立确认服药。0行动、意志28，必耗原瓶与原包。大成功精神−8；成功精神−15；失败健康−15、精神−25、排异+30；灾难健康−25、精神−45、排异+60。只有本次药物排异保底1。原始药效成功仍为序列5，实际回输同一份情感后才晋4；失败回输后仍5，放弃晋升并回输退出也仍5。费用、消耗与损失不退；晋升四属性各+1、新三项掌握0、扮演0、灵性上限120但当前不补满、身体性别不变，全部旧掌握与成果保留。';
export const UNSHADOWED_ABILITIES: { id: UnshadowedAbilityId; label: string; description: string }[] = [
  { id: 'sun.s4.unshadowed-domain', label: '无暗领域', description: '在有限原房间施展实际照明，核对原标记并沿同一普通门真实出入；领域没有实体墙，不声称透视一切物质或消除一切来源的阴影。5灵性与范围为G。' },
  { id: 'sun.s4.purification', label: '非凡特性有限净化', description: '获档案方许可处理同一块普通失控者遗留特性的有限精神污染，原物与所有权保留；神性与极端污染不保证可净化，也不能免费剥离自己特性而保留全部序列。实际检查可失败，6灵性与数值为G。' },
  { id: 'sun.s4.sunflare', label: '太阳耀斑', description: '在有限持照空场真实施展太阳耀斑，原靶留下热与灼痕；同伴须先实际离开范围，友善身份没有自动免疫。停止火焰不抹掉原靶余热，须真实冷却，6灵性与8米边界为G。' },
];
