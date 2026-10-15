import type { MagicianAbilityId } from './types.js';

/** Canonical six ingredients and main-material order; supply, labour and numerical rules are game-original (G). */
export const MAGICIAN_FORMULA_SOURCE = '《诡秘之主》第二部，第38章《收获》、第82章《材料齐》（六项材料与调配顺序）；俱乐部渠道、劳动、价格、周数、判定概率与属性数值均为本作原创游戏规则（G）。';
export const MAGICIAN_GUIDE = '占卜俱乐部指导者';
export const MAGICIAN_PRICES = { formula: 240, mainMaterials: 1800, auxiliaryMaterials: 150, brewing: 60 } as const;
export const MAGICIAN_BATCH_IDS = ['magician-batch-1', 'magician-batch-2', 'magician-batch-3'] as const;
export const MAGICIAN_MIN_CLOWN_WEEKS = 8;
export const MAGICIAN_LABOUR_STEPS = 4;
export const MAGICIAN_OIL_STOCK = 6;
/** Four auxiliaries first, then all the panther's spinal fluid, finally the treant's true root. */
export const MAGICIAN_FORMULA = [
  { id: 'pure-water', name: '纯水', quantity: 60, unit: 'mL' },
  { id: 'mist-treant-sap', name: '迷雾树人汁液', quantity: 30, unit: 'mL' },
  { id: 'water-shaped-gem', name: '水形宝石粉末', quantity: 3, unit: 'g' },
  { id: 'fantasy-grass-oil', name: '迷幻草精油', quantity: 4, unit: '滴' },
  { id: 'evil-pattern-panther-spinal-fluid', name: '邪纹黑豹全部脊髓液', quantity: 1, unit: '份' },
  { id: 'mist-treant-true-root', name: '迷雾树人真实根茎', quantity: 1, unit: '块' },
] as const;
export const MAGICIAN_ABILITIES: { id: MagicianAbilityId; label: string; description: string }[] = [
  { id: 'diviner.s7.damage-transfer', label: '伤害转移', description: '只能把仍然活着的受伤者身上的一处伤害，在此人自己的身体内部转移一次；可对自己或他人施展，不能转给另一个人，不能抹除伤势或挽回已经发生的死亡。' },
  { id: 'diviner.s7.flame-jump', label: '火焰跳跃', description: '新晋时在30米范围内，借真实存在的火焰或自己事先准备的火焰跳跃；没有实际火焰就没有落点，不能凭空制造目的地。' },
  { id: 'diviner.s7.air-bullet', label: '空气弹', description: '以灵性射出威力接近左轮手枪子弹的空气弹；它是真实攻击，不能自动命中或绕过伤势与生存判定。' },
  { id: 'diviner.s7.paper-figurine', label: '纸人替身', description: '必须事先用真实纸张剪好纸人，施展时消耗纸人与灵性；替身不能凭空补回，也不能替代已经结算的死亡。' },
  { id: 'diviner.s7.flame-control', label: '火焰操纵', description: '操纵30米范围内已经存在的火焰；完全消化之前不能凭空制造新的火焰流，未准备的场合必须先取得真实火源。' },
  { id: 'diviner.s7.illusion', label: '幻术', description: '制造颜色、声音和气味的感官幻象；不直接控制心智，不篡改记忆，也不把幻象变成真实物品。' },
  { id: 'diviner.s7.underwater-breathing', label: '水下呼吸', description: '借通往水面的空气管道在水下呼吸，适用于水面下约5米；并非无限深潜或无需空气。' },
  { id: 'diviner.s7.bone-softening', label: '骨骼软化', description: '软化骨骼以挣脱绳索等束缚、通过合适的狭窄处；不是力场，也不能无视真实障碍与伤势。' },
  { id: 'diviner.s7.paper-weapon', label: '纸张武器', description: '把实际持有的纸张暂时变成武器；需要真实纸料，不能永久制造装备或凭空增加库存。' },
];
export const MAGICIAN_CONSUMPTION_RISK = '本段数值为原创游戏规则（G）：服药必定消耗所选魔术师原瓶，0行动，意志难度18；小丑扮演须达100且小丑晋升后满8整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。指导者在场处理这次服药排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护仅适用于本次指导服药，不适用于战斗与其它危险。';
