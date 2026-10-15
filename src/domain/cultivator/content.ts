import type { CultivatorAbilityId } from './types.js';
export { CULTIVATOR_CASE_IDS } from './types.js';

/** Only the sequence names and the separate Physician recollection are verified. All S9 mechanics are original G. */
export const CULTIVATOR_GUIDE = '苗圃照料员伊芙·莫兰';
export const CULTIVATOR_PRICES = { guidance: 120, potion: 660, labourCredit: 600, garden: 60 } as const;
export const CULTIVATOR_BOTTLE_IDS = ['cultivator-potion-1', 'cultivator-potion-2', 'cultivator-potion-3'] as const;
export const CULTIVATOR_SOURCE_STATUS = '《诡秘之主》第三部第225章只核实名称顺序：序列9耕种者→序列8医师→序列7丰收祭司。第三部第226章回忆医师时期曾让植物生长；这不是序列9耕种者的完整能力表，不能据此把医师表现下放。耕种者实际序列9能力表与完整配方尚未核实。耕作知识、时令观察与细心照料三项能力均为本作原创G的有限知识与照料解释；需要普通种子、有限用水、实际劳动与真实跨周，不瞬间制造粮食、不控制天气，也不获得弗兰克序列6生物学家的杂交改造。苗圃照料员伊芙·莫兰是本作原创成年引导者；贝克兰德小苗圃、独立成品药渠道、普通劳务、三项实践、两周收成节奏及全部游戏数值均为本作原创G，不自动建立大地母神教会或其它组织身份。';
export const CULTIVATOR_POTION_SOURCES = CULTIVATOR_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${CULTIVATOR_GUIDE}独立保管的第${index + 1}瓶耕种者成品魔药，原瓶独立封存；贝克兰德小苗圃与供给为本作原创G，未声称现场配制。取得此瓶不建立大地母神教会或其它组织身份。`,
}));
export const CULTIVATOR_FORMULA_STATUS = '耕种者完整配方尚未核实，材料名称、主辅分类、数量与投料顺序均不作为已知内容。当前只开放本作原创G的独立成品原瓶；用药指导不构成完整制造配方，不解锁配方学习、魔药材料采购或调配，也不编造任何原料。60便士的3份普通种子与2份水仅为有限园圃物资，不是魔药配方或原料。';
export const CULTIVATOR_ABILITIES: { id: CultivatorAbilityId; label: string; description: string }[] = [
  { id: 'mother.s9.cultivation-knowledge', label: '耕作知识（G）', description: '本作原创G：依据眼前土壤记录、已有普通种子与实际照料条件作有限判断。知识不创造种子、水或肥料，不诊断未知异常，不代表已核实的原著序列9能力表。' },
  { id: 'mother.s9.season-observation', label: '时令观察（G）', description: '本作原创G：比较眼前时令与跨周生长记录，辨明本次照料的实际变化。不是预言，不控制天气，不把医师的植物生长表现或丰收祭司能力提前授予耕种者。' },
  { id: 'mother.s9.careful-practice', label: '细心照料（G）', description: '本作原创G：以实际劳动和有限物资完成播种、照料与分配，仍需真实跨周后收获有限产物。不瞬间制造粮食，不改变物种，也不获得弗兰克序列6生物学家的杂交改造。' },
];
export const CULTIVATOR_CONSUMPTION_RISK = '服药必定消耗所选原瓶，0行动，意志难度5。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。苗圃照料员在场处理严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护只适用于本次指导服药，不适用于战斗、异常接触及其它危险。有限园圃须实际买种与水、播种、跨周照料，再等待收成；停止本次操作不会返还已经消耗的种子与水，不重置生长日期，不复制收成。';
