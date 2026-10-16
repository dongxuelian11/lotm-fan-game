import type { UnagingDemonessAbilityId, UnagingDemonessPreparationId } from './types.js';

/** Canonical direction is separate from this explicitly finite original G implementation. */
export const UNAGING_DEMONESS_GUIDE = '54岁导师米蕾尔·阿什顿（UD3-MIREL，独立原创G人物）';
export const UNAGING_DEMONESS_PRICES = { guidance: 500, potion: 6400, labourCredit: 5500, preparation: 140 } as const;
export const UNAGING_DEMONESS_MIN_DESPAIR_WEEKS = 12;
export const UNAGING_DEMONESS_LABOUR_STEPS = 5;
export const UNAGING_DEMONESS_BOTTLE_IDS = ['unaging-demoness-potion-1', 'unaging-demoness-potion-2', 'unaging-demoness-potion-3'] as const;
export const UNAGING_DEMONESS_FORMULA_STATUS = '魔女途径序列3不老魔女已原核，完整配方与晋升仪式尚未核实。材料、用量、调配顺序和完整仪式均保持未知，不能因此断言无需仪式。不老泉只是尚待核实的条件假设，不列作已知材料。本阶段仅有明确本作原创G的独立成品渠道与专业支持；三项准备、当周场地检查和自我记录不冒充原著完整仪式，不开放自制配方。';
export const UNAGING_DEMONESS_SOURCE_STATUS = '不老魔女3具有长寿、年轻容貌与镜界通行方向的原著依据。卡特琳娜存活逾千年是原人物的个体经历，不能给每位新晋者写入统一寿命上限。第五部第163章的镜面离开会遇到镜内陷阱，第七部第9章本体沿镜界道路穿梭且可被阿蒙强行拉出：镜界通行不保证逃脱，不赋予高阶截留免疫、真空免疫、任意全球传送或自动复活。死亡后的镜替复活条件、次数与周期未核，不套用不死者的六十年规则；下一序列名称本次未核。两面原镜、唯一六米镜内道路、原小封包的一千克以内本场上界、每次开口六灵性与知识18、受控原入口返身窗口、全部场景和数值均为原创G。原成年人各自真实同意和退出，原身体、原物、原日期与既往记录保持真实。';
export const UNAGING_DEMONESS_POTION_SOURCES = UNAGING_DEMONESS_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${UNAGING_DEMONESS_GUIDE}介绍的独立不老魔女成品交接渠道本作G初始批次第${index + 1}瓶序列3成品魔药，独立封存原瓶${id}；非绝望魔女或更早原瓶改装。完整配方和原著晋升仪式仍未核实，专业准备另行实际完成。`,
}));
export const UNAGING_DEMONESS_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶原交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const UNAGING_DEMONESS_PREPARATIONS: { id: UnagingDemonessPreparationId; title: string; description: string }[] = [
  { id: 'REVIEW_RECORDS', title: '核对本人既往选择与真实身份记录', description: '本人核读自己既往真实服药、照护选择和原身体记录，以已有自我经历作为本次G支持参照；不凭空新造朋友或来信，不创造新信众、改写出生履历、删除原身体转变或把创建年龄重置为18。年轻外观不证明过去已经改变，也不提供永远安全的承诺。' },
  { id: 'TRACE_MIRRORS', title: '核验原镜道路与受限出口', description: '本人复核两面原镜A/B、已知唯一镜内路线与外部普通返回路线的说明。原镜可封闭或破损，镜内可遭截留；这一步不施法、不免费造镜、不移动身体到另一端，也不取得后来原主与观察员的同意。' },
  { id: 'MARK_RETURN', title: '标明本人与原物的实际返回顺序', description: '本人写下进入失败留A、退出失败留镜内、沿这条受控路线原路退回与普通归还的分支，标明本场原入口的有限单次返身窗口。此窗口不是任意镜面的全球保底，不承诺免死或高阶免疫；0行动收束不得凭空送回人或物。' },
];
export const UNAGING_DEMONESS_ABILITIES: { id: UnagingDemonessAbilityId; label: string; description: string }[] = [
  { id: 'assassin.s3.mirror-passage', label: '镜界通行（原镜有限路线G）', description: '原著支持本体沿镜界道路通行，也支持镜内陷阱和高阶强制截留。本场G只开放两面原镜间已知六米道路：进入实付6灵性、知识18检定，成功才由A进INNER_A；同一身体携同一原包实际走到INNER_B，另付6灵性、独立知识18成功才能从B退出。失败停留真实位置，不补灵性；可沿原路回INNER_A，从本次进入维持的原入口实际返身，窗口随离开关闭。受封B端不可强出，须实走外部路线请原观察员开板。战斗仅在两面完好未封原镜间移动同一身体，提供本轮有限定位或防守优势，不同时攻击；破镜或封镜后回退普通动作。不生成新镜、不开放任意传送、复活、神话形态或截留免疫。' },
];
export const UNAGING_DEMONESS_CONSUMPTION_RISK = '以下具体规则均为本作G：绝望魔女消化100，从原绝望魔女晋升周起12整周，健康>20且精神>40；三项不同1行动专业准备完成后，另付1行动140便士检查当周场地，0行动独立确认服用选定原瓶。意志难度30。大成功：晋升、精神−8；成功：晋升、精神−15；失败：未晋升、健康−15、精神−25、排异+30；灾难：中断晋升、健康−25、精神−45、排异+60。原瓶与本次准备耗尽，三项真实经历保留，可休养后重筹另一瓶并重做当次检查。G指导仅将这次药物排异后的健康和精神保底到1，不保护实际战斗或普通死亡。成功四属性各+1，绝望魔女消化100与旧掌握保留，只新增assassin.s3.mirror-passage一项0掌握；灵性上限120且当前不补满。年轻外观以本次真实晋升周登记，不改出生履历、创建年龄、原性别或原女巫身体变化。刺客至绝望魔女全部原瓶、材料、粉剂、原镜、丝线、同意与拒绝、真实病史及原敌生死保留；无免费补给、重复身体转变、镜替复活或不死者六十年周期。';
