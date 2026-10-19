export const ANCIENT_SCHOLAR_FORMULA = [
  { id: 'futogen-eyes', name: '福根之犬的眼睛', quantity: 1, unit: '对' },
  { id: 'fog-wolf-heart', name: '雾之魔狼的絮化心脏', quantity: 1, unit: '颗' },
  { id: 'futogen-blood', name: '福根之犬血液', quantity: 100, unit: 'mL' },
  { id: 'fog-wolf-frost', name: '雾之魔狼白霜结晶', quantity: 30, unit: 'g' },
  { id: 'verified-history', name: '大量真实古代历史记录', quantity: null, unit: '经核验记录', note: '由本次实际取得的三卷古代原档案制作独立批次核验誊本；不虚构原著未给出的重量。' },
  { id: 'professional-support', name: '未核余项的专业封装支持G', quantity: 1, unit: '原封包', note: '原著可见辅料清单末有省略号；本作不声称已知完整细项。' },
] as const;
export const ANCIENT_SCHOLAR_SOURCE = '原著第五部第108章的已核核心材料与至少三百年完全脱离现实要求；未知余项由明确本作G专业封装支持，不冒称完整原著配方。';
export const ANCIENT_SCHOLAR_BOUNDARY = '静封钟AS3-STASIS-1、费用、长期活体/原物保护、后世机构与重审细则均为原创G。原件固定在AS3-VAULT，不能带走、出售或用于战斗；只维持登记同一活体及舱内登记原件，不治疗入舱旧伤、不回灵性、没有外界通信。跨小说末日后的时代为本作原创后世分支。';
export const ANCIENT_SCHOLAR_REASSESSMENT = '满300年退出后，本作G允许核对既有连续300年原履历、另付新准备并重新隔绝14天后再审；这是有限重筹规则，不宣称原著必须再次等300年。未满300年的提前退出不够资格，世界已流逝年月保留，重来仍须新完整300年。';
export const ANCIENT_SCHOLAR_CONSUMPTION_RISK = '当前原瓶只有仍在封室、已本地核验同一原身体和至少300年连续隔绝，或本作G重新隔绝14天复审后才能饮用。成功或大成功真实晋升3；失败耗原瓶、伤害与排异保留，G设施仅对本次药物排异保底1，普通战死不能复活。室内仅三次有限付费休养，有登记备用原瓶才可重试；离舱后资格窗口关闭。';
export const ANCIENT_SCHOLAR_PRICES = { formula: 180, material: 1500, labourMaterial: 180, brewing: 60, facility: 360, facilityLabour: 120, isolationRest: 12, work: 24, rest: 8, weekly: 24 } as const;
export const ANCIENT_SCHOLAR_LABOUR_STEPS = 3;
export const ANCIENT_SCHOLAR_PREPARATIONS = {
  CHECK_CONTAINER: '与玛拉实际检查原身体容器和原瓶槽',
  CHECK_LOCAL_CLOCK: '实际校准封室内机械钟与断通信结构',
  REGISTER_SEALS: '核对原封条并交存同体、原瓶和史料登记',
} as const;
export const ANCIENT_SCHOLAR_RECORDS = [
  { id: 'AS3-RECORD-145', age: 145, title: '旧航运会145年前原货舱登记合卷', source: 'AS3-ARCHIVE遗产档案机构持有的旧航运会原连续登记册、同年押印与接收目录' },
  { id: 'AS3-RECORD-170', age: 170, title: '旧制纸坊170年前原生产与工资合卷', source: 'AS3-ARCHIVE实际存放的原纸坊水印样与连续账页、独立封存接收簿' },
  { id: 'AS3-RECORD-230', age: 230, title: '旧石桥所230年前原修缮与交接合卷', source: 'AS3-ARCHIVE原石桥所测绘、修缮签押与前后两次保管交接册' },
] as const;
export const ANCIENT_SCHOLAR_ABILITIES = [
  { id: 'diviner.s3.borrow-past', label: '借用过去的自己', description: '仅借真实留存的自身状态样本；有限时间与灵性成本，不把更弱过去变无条件增强，结束不永久疗伤或补满。' },
  { id: 'diviner.s3.historical-projection', label: '历史影像', description: '初学一次仅1个已实际了解普通物影像、至多30秒G；有独立影像ID和原历史来源，不能出售、复制原物或问出未知秘密。' },
  { id: 'diviner.s3.history-shelter', label: '躲入历史片段', description: '只进入自身真实经历且已经研究的有限片段，短时后回同一安全现场；不能修改历史或任意进入天使/唯一性库。' },
] as const;
