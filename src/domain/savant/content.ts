import type { SavantAbilityId, SavantProjectId } from './types.js';
export { SAVANT_PROJECT_IDS } from './types.js';

/** Canonical S9 boundary: enhanced memory, learning and practice applied to learned knowledge.
 * The workshop, mentor, finite finished potions, jobs and prices are original game content (G).
 * A complete original S9 recipe has not been verified; no ingredients are invented here. */
export const SAVANT_GUIDE = '工坊导师埃德温·沃德';
export const SAVANT_PRICES = { guidance: 120, potion: 660, labourCredit: 600 } as const;
export const SAVANT_BOTTLE_IDS = ['savant-potion-1', 'savant-potion-2', 'savant-potion-3'] as const;
export const SAVANT_POTION_SOURCES = SAVANT_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${SAVANT_GUIDE}工坊保管的第${index + 1}瓶通识者成品魔药，原瓶独立封存；导师与工坊供给为本作原创G，未声称在工坊配制。`,
}));
export const SAVANT_FORMULA_STATUS = '通识者完整配方资料待核；目前未开放配方学习与制造，只能取得工坊现有的独立成品原瓶，不编造配方材料。';
export const SAVANT_ABILITIES: { id: SavantAbilityId; label: string; description: string }[] = [
  { id: 'paragon.s9.memory', label: '记忆唤醒', description: '更准确地回忆亲自读过、学过或经历过的内容，按真实记录重建步骤；没有接触过的知识不会自动出现。' },
  { id: 'paragon.s9.learning', label: '学习增强', description: '更快理解教材、图纸和实际讲解，再通过核对学习科学与机械知识；仍须先取得并学习相应资料，不是生来全知。' },
  { id: 'paragon.s9.practice', label: '实践增强', description: '把已经学会的知识用于普通工具操作与维修制作；需要实际材料、工具和工作台。不能鉴定未知神奇物品，也不能制作非凡器物。' },
];
export const SAVANT_CONSUMPTION_RISK = '服药必定消耗所选原瓶，0行动，意志难度5。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。导师在场处理严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护只适用于本次指导服药，不适用于战斗与其它危险。';

/** Ordinary workshop commissions, all G. Each has its own real tools and repair stock. */
export const SAVANT_PROJECTS: {
  id: SavantProjectId; title: string; story: string; plan: string; materials: string; tool: string;
}[] = [
  {
    id: 'shelf-repair', title: '街角书店的松动书架',
    story: '书店把一座空书架送到工坊。右侧连接松动，店主希望修好后继续使用；书架一直归店主所有。',
    plan: '阅读连接示意图，测量松动处，装入木楔并紧固普通角撑，再在工作台检查承重。',
    materials: '一组普通木楔与角撑', tool: '书架维修工具组：木锤与螺丝刀',
  },
  {
    id: 'handcart-wheel', title: '手推车的偏摆车轮',
    story: '搬运工将卸空的手推车停在工坊。一个车轮转动时偏摆，只有量过轮轴与垫圈才能找准调整位置。',
    plan: '学习轮轴装配图，核对轴隙，替换磨损垫圈并润滑，空载推行检查是否仍然偏摆。',
    materials: '一组普通垫圈与润滑油', tool: '车轮维修工具组：扳手与量规',
  },
  {
    id: 'lamp-shutter', title: '值班室的灯罩遮片',
    story: '值班室送来一盏已经熄灭的灯。遮片卡住，灯具没有非凡性质；管理员只要求恢复普通遮光功能。',
    plan: '阅读遮片结构草图，在熄灯状态下校平导槽并装入替换薄片，检验开合行程。',
    materials: '一片普通金属薄片与固定销', tool: '灯罩维修工具组：钳子与锉刀',
  },
  {
    id: 'dispatch-tray', title: '邮件室的分拣托盘',
    story: '邮件室请工坊制作一只分格托盘，尺寸与信件类别已经写在委托单上。你接触的是空白样件，不会因此知道私人信件内容。',
    plan: '学习委托单与尺寸图，测量木板并组合分格，校对标签位置后用空白纸片试装。',
    materials: '一组裁好的普通木板与木钉', tool: '托盘制作工具组：直尺与木工夹',
  },
];
