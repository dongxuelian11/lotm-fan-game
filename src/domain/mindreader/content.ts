import type { MindreaderAbilityId } from './types.js';

/** Ingredient names and quantities are canonical; this list does not assert a brewing order.
 * The existing reading-room mentor, finite supply rounds, prices and numerical effects are original game rules. */
export const MINDREADER_FORMULA_SOURCE = '《诡秘之主》第一部《小丑》第155章《紧急见面》（六项材料与用量），第158章《有备无患》（幻影亚龙即七彩蜥龙、半幽灵兔即法尔斯曼兔）；具体投料顺序尚未核实，清单顺序不表示原著调配顺序。阅览室渠道、劳动、价格与游戏数值为本作原创。';
export const MINDREADER_GUIDE = '阅览室观察导师';
export const MINDREADER_PRICES = { formula: 180, mainMaterials: 1200, auxiliaryMaterials: 110, brewing: 60 } as const;
export const MINDREADER_BATCH_IDS = ['mindreader-batch-1', 'mindreader-batch-2', 'mindreader-batch-3'] as const;
export const MINDREADER_MIN_AUDIENCE_WEEKS = 6;
export const MINDREADER_FORMULA = [
  { id: 'rainbow-lizard-dragon-pituitary', name: '成年七彩蜥龙的完整脑垂体', quantity: 1, unit: '份' },
  { id: 'farsman-rabbit-spinal-fluid', name: '法尔斯曼兔的脊髓液', quantity: 10, unit: 'mL' },
  { id: 'chestnut-spores', name: '栗树芽孢', quantity: 5, unit: 'g' },
  { id: 'dragon-tooth-grass', name: '龙牙草粉末', quantity: 8, unit: 'g' },
  { id: 'pure-white-elf-flower', name: '纯白精灵花', quantity: 3, unit: '瓣' },
  { id: 'pure-water', name: '纯水', quantity: 100, unit: 'mL' },
] as const;
/** Surface thoughts, emotional aura and preliminary thought simulation: 第二部第146章《渎神者》. */
export const MINDREADER_ABILITIES: { id: MindreaderAbilityId; label: string; description: string }[] = [
  { id: 'audience.mind-reading', label: '读心', description: '直接观察气场与以太体呈现的情绪颜色，结合动作读取当下浅层想法，并初步模拟对方的思维。得到的是目标此刻的心声与情绪，不是客观真相；不能检索深层记忆或直接控制他人。' },
];
export const MINDREADER_CONSUMPTION_RISK = '服药必定消耗所选读心者原瓶，0行动，意志难度12；观众扮演须达100且首次晋升后满6整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。导师在场处理这次服药排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护仅适用于本次指导服药，不适用于战斗与其它危险。';
