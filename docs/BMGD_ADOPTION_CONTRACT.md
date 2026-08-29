# BMGD 隔离试用与权威边界

`STATUS=LOCKED_PILOT_POLICY / AUTHORITY=PROJECT_STATE_LEDGER.md / PRODUCT_AUTHORITY=NONE`

## 1. 已确认结论

用户已于 2026-08-29 同意采用 BMad Game Dev Studio（BMGD）辅助本项目，但只把它作为旁路设计审查、模板参考和实施前查漏工具。它不成为总设计系统，不取代用户、设计 Grill、项目总账本、轮次合同或主题设计文档。

审计来源：

- 仓库：`https://github.com/bmad-code-org/bmad-module-game-dev-studio`
- 本轮核验的公开 `main`：`478cc09f2e2f9a1fc6d78b1eb7e19fe0323fc08e`
- 许可证：MIT；复制或改造其模板/代码时必须保留许可证和真实归属。
- 当前元数据：`package.json` 为 `0.7.1`，`src/module.yaml` 为 `0.7.0`；按 0.x 工具处理，不假定接口或输出稳定。

## 2. 项目权威层级

BMGD 自己把 GDD 定义为其流程中的设计真值源，本项目明确覆盖这一默认：

1. 用户最新明确决定；
2. `PROJECT_STATE_LEDGER.md` 的锁定决定；
3. 当前轮合同与 `docs/ARCHITECTURE_CONTRACT.md`；
4. 本项目主题设计文档；
5. BMGD 输出。

BMGD 输出永远标记为 `PROPOSAL_ONLY`、`VALIDATION_FINDING` 或 `REFERENCE_TEMPLATE`，不得标记为 `LOCKED`、`IMPLEMENTATION_AUTHORITY`、`DESIGN_SYNC` 或玩家验收证据。

## 3. 第一阶段允许使用的能力

只允许在隔离副本或只读输入上运行：

- `gds-gdd` 的 **Validate/Analyze** 模式：检查遗漏、矛盾、范围漂移和可测量性；
- `gds-check-implementation-readiness`：检查 GDD/UX/架构/任务拆分是否一致；
- 叙事、UX 和事件卡模板只可作为结构参考，待对应玩法边界锁定后再提取候选；
- 架构、Epic、Story 和生产工作流只可在主任务已经冻结对应轮次后辅助拆解。

第一阶段禁止：

- 对权威设计文档运行 GDD Create/Update/Finalize；
- 让 BMGD 重写、合并或替换 `PROJECT_STATE_LEDGER.md` 与主题设计文档；
- 使用 Quick Dev 或生产工作流绕过当前 R1 玩家验收、R2 冻结或 Grill 门；
- 让 BMGD 自动决定玩法、数值、原著解释、事件内容、能力效果或范围；
- 把其 lint/Markdown/格式检查当作游戏设计质量、运行时正确性或玩家验收。

## 4. 隔离目录与数据规则

- 本地试用根目录：`.bmgd-evaluation/`；整个目录由 Git 忽略，不进入公共仓库。
- `bmgd-source-478cc09.bundle`：固定到已审计提交的完整 Git bundle；可离线校验精确 SHA。
- `work/`：需要运行时临时从 bundle 展开；试用结束后删除，避免第三方模板进入项目总账审计范围。
- `inputs/`：需要时放置权威文档的临时副本或清单，不在副本上产生反向同步。
- `outputs/`：BMGD 生成的候选报告；只能由主任务人工复核后摘录。
- 不向 BMGD 输入原著正文、私人 RAG 语料、凭据、运行数据库、存档或未公开用户数据。
- 任何安装脚本、模型调用或外部连接必须另行核查；本合同不自动授权凭据、联网模型或发布。

## 5. Grill 与开发门禁

若 BMGD 发现的问题会改变玩家体验、规则、数值、内容规模、原著解释或冻结边界：

1. 只记录为 `DESIGN_GAP_CANDIDATE`；
2. 主任务先与现有锁定决定去重；
3. 确认确属未决后，按项目规则暂停所有非 Grill 任务；
4. 由专门 Grill 任务向用户提问；
5. 用户回答由主任务固化并完成公开 `DESIGN_SYNC` 后，开发才能消费。

BMGD 不得直接向用户发起另一套设计采访，也不得重问已锁定项目。

## 6. 试用验收标准

首轮试用只算 `PILOT_USEFUL`，当且仅当报告：

- 能指出至少一个有来源定位的真实遗漏、冲突或不可验证项；
- 不把已锁定决定重新包装成问题；
- 不产生未经用户确认的新规则；
- 明确区分设计建议、工程缺口和已知延期项；
- 不修改权威文件，不改变 R1/R2、Grill、打包或发布真值。

否则记为 `PILOT_NOT_ADOPTED`，保留本审计记录但不继续集成。

## 7. 首轮试用记录

`PILOT_ID=BMGD-PILOT-001 / DATE=2026-08-30 / RESULT=PILOT_USEFUL_WITH_ADAPTER_REQUIRED / GRILL_TRIGGERED=NO`

- 固定源码以 `.bmgd-evaluation/bmgd-source-478cc09.bundle` 保存；已从完整克隆生成，并实际离线还原到精确 SHA `478cc09f2e2f9a1fc6d78b1eb7e19fe0323fc08e`。浅克隆生成的首个 bundle 虽可通过静态 verify，但恢复失败，已废弃。
- GDD Validate 使用的只读映射：主类型 `rpg`，辅类型 `horror/text-based`；这只是 BMGD 验证元数据，不是新的玩法锁定。
- 输入映射以 `PROJECT_STATE_LEDGER.md` 为总入口，主题规则来自 `docs/CORE_LOOP.md`、`docs/NUMERIC_SYSTEM.md`、`docs/COMBAT_ROULETTE.md`、`docs/CHARACTER_AND_PROGRESSION.md`、`docs/EVENT_CARD_SYSTEM.md` 和 `docs/UI_IMPLEMENTATION_PLAN.md`；工程/轮次来自 `docs/ARCHITECTURE_CONTRACT.md`、`docs/MASTER_DEVELOPMENT_PLAN.md` 与当前轮合同。
- 验证结论：核心循环、范围和 R1 边界可追溯；序列能力、完整成长/物品/任务内容属于已知 R6/R7 延期，不是新问题；没有需要立即 Grill 的新玩家设计缺口。
- 唯一新的高信号缺口是工具适配：BMGD 原生期待单体 GDD/Epics/UX，不能自动理解本项目的分布式权威文档。
- Implementation Readiness 只完成文档发现预检，状态为 `BLOCKED_BY_DOCUMENT_SHAPE_AND_PHASE_MISMATCH`；R1 已进入实现后玩家验收、R2 尚未冻结，当前不得给出 `READY`，也不得用该工作流替代 R1 玩家验收。
- 结构化结果保存在 Git 忽略的 `.bmgd-evaluation/outputs/pilot-001/validation-findings.json`。
