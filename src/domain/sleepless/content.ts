import type { SleeplessAbilityId } from './types.js';
export { SLEEPLESS_WATCH_IDS } from './types.js';

/** S9 boundaries: darkvision, reduced sleep with daytime rest, night-deepening physical
 * and perceptual strength, and limited danger sensing. No S8 poetry or S7 dream powers.
 * Mentor, independent finished-potion supply, jobs, prices and numbers are authored G. */
export const SLEEPLESS_GUIDE = '退役守夜导师赛琳·莫尔';
export const SLEEPLESS_PRICES = { guidance: 120, potion: 660, labourCredit: 600 } as const;
export const SLEEPLESS_BOTTLE_IDS = ['sleepless-potion-1', 'sleepless-potion-2', 'sleepless-potion-3'] as const;
export const SLEEPLESS_POTION_SOURCES = SLEEPLESS_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${SLEEPLESS_GUIDE}私下保管的第${index + 1}瓶不眠者成品魔药，原瓶独立封存；导师与独立供给为本作原创G，未声称现场配制。取得此瓶不建立教会或其它组织身份。`,
}));
export const SLEEPLESS_FORMULA_STATUS = '不眠者完整配方尚未在现有原著核验中找到；目前未开放配方学习与制造，只能取得导师现有的独立成品原瓶，不编造配方材料。';
export const SLEEPLESS_ABILITIES: { id: SleeplessAbilityId; label: string; description: string }[] = [
  { id: 'darkness.s9.night-vision', label: '黑暗视物', description: '在黑暗中看清眼前景物，辨认真实可见的地面、门窗和障碍；不能透视墙壁、读取记忆或自动辨认未知怪物。' },
  { id: 'darkness.s9.night-vigor', label: '夜间精力与强化', description: '夜晚可以保持清醒，睡眠需求减少，白天仍需约三至四小时休息；夜色加深时力量、敏捷与感知增强。当前游戏不逐小时模拟睡眠，也不凭此增加周行动、免除伤势或取消休养。' },
  { id: 'darkness.s9.danger-sense', label: '危险感应', description: '对附近危险保有敏锐感应，提醒你停步、观察和核实；感应不等于知道危险来源、幕后身份或安全路线。面对怪物仍可能需要实际弹药或外部工具，没有催眠诗歌或入梦能力。' },
];
export const SLEEPLESS_CONSUMPTION_RISK = '服药必定消耗所选原瓶，0行动，意志难度5。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。导师在场处理严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护只适用于本次指导服药，不适用于战斗与其它危险。';
