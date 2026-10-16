import { NOTARY_GUIDE } from '../notary/content.js';
import type { PriestOfLightAbilityId } from './types.js';
export { PRIEST_OF_LIGHT_CASE_IDS } from './types.js';
export const PRIEST_OF_LIGHT_GUIDE = NOTARY_GUIDE;
export const PRIEST_OF_LIGHT_PRICES = { formula: 460, mainMaterials: 4200, auxiliaryMaterials: 600, brewing: 100, ritualTravel: 180, ritualAssistance: 120 } as const;
export const PRIEST_OF_LIGHT_BATCH_IDS = ['priest-of-light-batch-1', 'priest-of-light-batch-2', 'priest-of-light-batch-3'] as const;
export const PRIEST_OF_LIGHT_MIN_NOTARY_WEEKS = 12;
export const PRIEST_OF_LIGHT_LABOUR_STEPS = 5;
export const PRIEST_OF_LIGHT_LABOUR_TASKS = ['核对本批六料', '检查本批主材封签', '量记本批四项辅材', '整理本批独立领用记录', '清理本批原调配台'] as const;
export const PRIEST_OF_LIGHT_FORMULA = [
  { id: 'dawn-rooster-king-red-crown', name: '黎明雄鸡之王的红冠', quantity: null, supplyQuantity: 1, unit: '份', note: '已核原著未给明确用量；本作G每批供货一份原红冠，不编造克重。' },
  { id: 'pure-white-radiance-stone', name: '纯白光辉石', quantity: 1, supplyQuantity: 1, unit: '块' },
  { id: 'rosemary', name: '迷迭香', quantity: 5, supplyQuantity: 5, unit: 'g' },
  { id: 'golden-finger-citron-juice', name: '金手柑汁', quantity: 7, supplyQuantity: 7, unit: '滴' },
  { id: 'rock-water', name: '岩水', quantity: 10, supplyQuantity: 10, unit: 'mL' },
  { id: 'dawn-rooster-king-blood', name: '黎明雄鸡之王血', quantity: 60, supplyQuantity: 60, unit: 'mL' },
] as const;
export const PRIEST_OF_LIGHT_FORMULA_SOURCE = '《诡秘之主》第三部第204章已核光之祭司六项配方：主材黎明雄鸡之王的红冠、纯白光辉石1块；辅材迷迭香5g、金手柑汁7滴、岩水10mL、黎明雄鸡之王血60mL。红冠的原著用量未明确，本作G按每批一份原批供货，不编造克重。没有额外纯水；清单不代表已核投料顺序，实际调配采用本作G导师规程。';
export const PRIEST_OF_LIGHT_ICE_SOURCE = 'PL5-ICE-1';
export const PRIEST_OF_LIGHT_RITUAL_SOURCE = '原著仪式要求纯粹的外在黑暗，原身体埋在正常情况下不会融化的冰内；第五部第68章实际由他人协助将真实魔药喂给原身体，梦境中的虚假服药不能替代。外在黑暗采用普通完全遮光即可，不声称必须创造高阶黑暗领域。本作G：原导师预约原礼拜堂封闭地窖，原专业仪式库存中封存的同一批正常不融冰PL5-ICE-1，具体冰源与装置为G，不编造原著化学成分。1行动预约，最早下一真实周出行；1行动、180便士预付普通本地往返，另120便士请原成年导师与受训助手操作既有冰室、核验普通完全遮光、将你的原身体实际埋入原冰，以原预设狭窄仪式通道将所选真实原瓶交由导师喂服。撤出由原助手开室并实际移开原冰、移出原身体，0行动；原冰保留，不是玩家制造或施法消耗。0行动结束与普通返程始终可用，不退款、不补药或恢复资源。冰内与喂药只作虚构G叙述，不提供现实低温或密闭操作说明。每次最多服一原瓶，正常可能失败，下一次需重新预约并跨真实周。';
export const PRIEST_OF_LIGHT_SOURCE_STATUS = '序列5光之祭司具有更强圣光、黑暗中视物与净化光环；当前只在有限原现场照明、减弱原石板上的少量残留死灵痕迹，并如实面对净化光环也会影响友善灵体的边界。不会自动识别善恶或排除同伴；普通成年人不因此被标成邪恶、亡灵或得到克制伤害。继承原歌颂者、祈光人、太阳神官和公证人全部能力。不是万能治疗、复活、去除一切恐惧、清洗非凡特性，也未取得序列4无暗领域。场景、范围、费用、成熟周数、判定和奖励为本作G。';
export const PRIEST_OF_LIGHT_ABILITIES: { id: PriestOfLightAbilityId; label: string; description: string }[] = [
  { id: 'sun.s5.holy-light', label: '强化圣光', description: '以真实圣光照亮有限黑暗场地，有限减弱适用的原残留死灵痕迹；保留黑暗中视物边界。原创练习为原3米工作间照明与空石板有限残痕核对，不是治疗活人、清空宇宙污染或制造真相。对普通人的战斗圣光按正常攻击判定，没有自动邪恶克制。' },
  { id: 'sun.s5.purification-aura', label: '净化光环', description: '有限净化光环会影响附近灵体，也会影响友善的栖灯；和平实践须请原主人沿实际8米路线将原灯与原灵移到本作G5米范围之外。3灵性、意志14与范围为G，可能失败；必须显式关闭，不能自动豁免同伴、把友善灵体清除成奖励或冒称无暗领域。' },
];
export const PRIEST_OF_LIGHT_CONSUMPTION_RISK = '本段数值为本作G：公证人扮演100、晋升后满12整周、健康高于20、精神高于40；原身体在真实正常不融冰中且现场完全遮光、原成年导师在场，才可独立确认所选真实原瓶。0行动、意志难度26，原瓶必耗尽。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、健康−10、精神−20、排异+25；灾难：中断晋升、健康−20、精神−40、排异+50。导师只处理本次服药排异，不随机即死；休养每次消退至多10排异，原瓶不恢复，不保护战斗。晋升四属性各+1，灵性上限100但当前灵性不补满；全部旧掌握与原公证人成果保留，新增两项掌握从0开始。服药前后均可0行动请原助手实际移冰撤出，再0行动按已付原路返回。';
