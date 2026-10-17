import { ANCIENT_ALCHEMIST_GUIDE } from '../ancient-alchemist/content.js';
import type { CoffinBearerAbilityId, CoffinBearerPreparationId } from './types.js';

/** Only the sequence names are verified. Every added mechanism, original object and number is G. */
export const COFFIN_BEARER_GUIDE = ANCIENT_ALCHEMIST_GUIDE;
export const COFFIN_BEARER_PRICES = { guidance: 500, potion: 6400, labourCredit: 5500, preparation: 140 } as const;
export const COFFIN_BEARER_MIN_ANCIENT_ALCHEMIST_WEEKS = 12;
export const COFFIN_BEARER_LABOUR_STEPS = 5;
export const COFFIN_BEARER_BOTTLE_IDS = ['coffin-bearer-potion-1', 'coffin-bearer-potion-2', 'coffin-bearer-potion-3'] as const;
export const COFFIN_BEARER_FORMULA_STATUS = '原核直接确认母亲途径序列3抬棺人、下一阶序列2荒芜主母与序列1自然行者；抬棺人完整主辅配方、材料用量、调配顺序与晋升仪式尚未披露，仍保持未知，不能因此断言无需仪式。同一位原成年导师伊芙·莫兰只经明确原创G的独立成品渠道交接本批三个独立原瓶，实际准备原苗圃旁安静原房、普通退出路线与在场支持。三项真实专业准备和当周原房检查完全为G，不冒充原著完整仪式，不开放自制魔药。';
export const COFFIN_BEARER_SOURCE_STATUS = '第七部55 L231911直接确认母亲途径3抬棺人→2荒芜主母→1自然行者。本阶完整配方、晋升仪式与新增能力未核；不能由名称发明复活、造魂、死人操纵或棺材免死。mother.s3.finite-preservation是明确原创G的有限活性保全，只承接已核低阶生命方向，具体规则不是原著细则。46岁成年自主所有者CB3-ADA艾达·芬恩、39岁成年自主接收照料者CB3-LENA莉娜·肖、42岁成年CB3-NOLAN诺兰·韦斯特、三不同原样本、原转运匣原牌原纸原衬片、新原护腕及所有场地、当前许可、时限、距离、成本、检定、数值和奖励均为原创G。原活盆CB3-LIVE-1/2具有独立原温室培养记录，原CB3-DRY-1早已自然枯萎；它们不是旧AA4-STEM-1变出或替换的样本。仅减慢当前仍活样本本次有限暴露的衰减，不增加活性、治疗、改死亡或证明永久保全。旧耕种者至古代炼金师六个阶段全字段冻结，原AA4-OSRIC-VALE奥斯里克原伤势、资源与投降结果不重开；旧护腕、原材料、原茎原盆和原报告不移入新库。新CB3-GUARD必须以新原材料另外实际制作，其三段不自动补充，也不是原著护腕。原身体与普通死亡不因本次晋升重开。';
export const COFFIN_BEARER_POTION_SOURCES = COFFIN_BEARER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${COFFIN_BEARER_GUIDE}介绍的独立抬棺人成品交接渠道本作G初始批次第${index + 1}瓶序列3成品魔药，独立封存原瓶${id}；非古代炼金师或更早原瓶改装。名称编号有直接原核，成品供给与专业准备均为G；完整配方和原著晋升仪式未披露，专业准备另行实际完成。`,
}));
export const COFFIN_BEARER_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶原交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const COFFIN_BEARER_PREPARATIONS: { id: CoffinBearerPreparationId; title: string; description: string }[] = [
  { id: 'REVIEW_RECORDS', title: '核对既有母亲路线经历与原记录', description: '本人核读原古代炼金师晋升、原奥斯里克实际伤势与原投降结果，原活茎原盆、原惰性基质、已交诺拉的原报告和旧AA4护腕。耕种者、医师、丰收祭司、生物学家、德鲁伊与古代炼金师六阶原瓶、掌握、人物和原物全字段保留；本次晋升不治疗、不复活、不返还灵性、不移动或复制旧原物。' },
  { id: 'CHECK_LIMITS', title: '核验有限活性、枯样与当前许可边界', description: '与原伊芙明确本场原创G安排：只对当前仍活样本的一次观察暴露施加60秒有限保全，不提升原活性、改死亡、治疗或创造灵魂。原枯样始终0且不可复活；每案分别核对原样ID、当前许可和固定原纸。莉娜可撤回当次接收与保全许可，必须停止未用影响、带同一原样返回所有者，先前许可不代替本案同意。' },
  { id: 'MARK_EXIT', title: '标明原安静房与普通转运退出路线', description: '本人实际核对CB3-QUIET-ROOM独立安静房、START至A4米和A至B4米净空普通路。两个不同0.5千克原活盆和一个0.1千克原枯样归艾达，原转运匣仅承重1千克、一次一个样本，没有免伤或复活。本人普通携匣亲取原样、实际交接或原路返回，原匣原牌和用后惰性片须实际交还；下一案亲到A领回原匣，不瞬移、复制或凭空补片。' },
];
export const COFFIN_BEARER_ABILITIES: { id: CoffinBearerAbilityId; label: string; description: string }[] = [
  { id: 'mother.s3.finite-preservation', label: '有限活性保全（原创G）', description: '本作G有限延伸，不是已核实的原著3新增能力。和平1行动5灵性2精神及一片原衬片、知识20四档；成功让同一仍活样本在60秒内每20秒衰减1活性，通常观察暴露每10秒衰减1，不提高活性或改死亡；失败照付且片仍变为同一惰性原件。只有本案CHECK后且尚未归还或交付的样本计时，正式照料停止本批测试计时、不赠活性。枯样施术拒绝且不收费，普通核验1行动、不施术不检定不耗材料。当前许可撤回须停止未用效果，真实往返交还。成功且真实保全后实际交付的fresh-transfer报告加8掌握；撤回、枯样、普通或失败无掌握。实战K必须实际持有另行制作的新CB3-GUARD未用原段，付一段与5灵性、知识20四档，成功本轮最多两次后续正BODY或ARC贡献×0.8；失败照耗，B或K任一待用时不叠加不重复付费。无段或不足灵性普通走位0耗费，轮末清未用效力，用后段保持SPENT。不改伤势后果盘、不抵死亡、不清旧伤、不复活、不治疗旧奥斯里克，不以抬棺人名称操纵死人。' },
];
export const COFFIN_BEARER_CONSUMPTION_RISK = '以下具体规则均为本作G：古代炼金师消化100，从原古代炼金师晋升周起12整周，健康>20且精神>40；三项不同1行动专业准备完成后，另付1行动140便士检查当周原安静房与普通出口，0行动独立确认服用选定原瓶。意志难度30。大成功：晋升、精神−8；成功：晋升、精神−15；失败：未晋升、健康−15、精神−25、排异+30；灾难：中断晋升、健康−25、精神−45、排异+60。原瓶与本次准备耗尽，三项真实经历保留，可休养后重筹另一瓶并重做当次检查。G指导仅将这次药物排异后的健康和精神保底到1，不保护实际战斗或普通死亡。成功四属性各+1，原古代炼金师消化100与旧掌握保留，只新增mother.s3.finite-preservation一项0掌握；灵性上限120且当前不补满。六阶段原瓶、原物、原人物与原敌伤势生死不改，原奥斯里克的投降不会重开，旧护腕三段不变；身体、身份、年龄与性别不变。序列3名称编号有原核，全部新增机制、成品与专业准备均G；完整配方、仪式和本阶原著新增能力未知。';
