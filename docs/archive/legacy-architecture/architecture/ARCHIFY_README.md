# 架构图与防漂移门禁

`ARCHIFY_VERSION=2.16.0 / DIAGRAM_STATUS=FROZEN_BASELINE / PRODUCT_IMPLEMENTATION_AUTHORITY=NONE`

本目录保存开工前必须冻结的架构图。它把 `docs/ARCHITECTURE_CONTRACT.md` 可视化，帮助主任务、前端任务和后端任务从同一 Module、Interface、Seam 与 Adapter 结构开工；它不取代总账本、轮次合同、玩家验收或运行证据。

## 当前基线

- 类型化源：`runtime.archify.json`；
- 自包含交互图：`runtime-architecture.html`；
- 校验与交付回执：`runtime-architecture.receipt.json`；
- 源码证据基线：`24ec3ddfa9bde1665aa48a794793414211021f80`；
- Archify：官方 `tt-a1i/archify`，固定 `v2.16.0`，用户级开发工具，不进入产品运行依赖；
- 规格 SHA-256：`1392f8820aa2f8eb52e02feb62056f98b7be87a5c71f7604f60317ace2d4763f`；
- HTML SHA-256：`70ed7f30be2d6e0ef4ad6c5623b99babf898065017b26391139f3b8635b29e19`。

当前图包含浏览器审查链、桌面权威链和公开信任面三种阅读视图；只描述已经由源码或架构合同支持的事实。`可选本地 AI` 明确标记为尚未实现，不得由图推导为已有运行能力。

## 防漂移规则

冻结任何新施工轮前，主任务必须在轮次合同记录：

```text
ARCHITECTURE_BASELINE_SPEC_SHA256=
ARCHITECTURE_CHANGE=NONE|<changed modules/seams/adapters>
ARCHITECTURE_STATUS=VALIDATED_SHOWCASE|DRIFT_BLOCKED
```

以下变化必须先更新 `docs/ARCHITECTURE_CONTRACT.md` 和 `runtime.archify.json`，完成 Archify `showcase` 校验、原子交付和真实浏览器检查，再下发开发任务：

- 新增、删除或改变顶层运行时 Module；
- 新增跨 Module 依赖或改变依赖方向；
- 扩大 Public Contract Seam、Renderer 权限或公开投影；
- 新增或替换 Browser、Electron、SQLite、RAG/模型等 Adapter；
- 改变运行时权威、事务/回执路径或前后端写集边界。

以下变化默认不要求重画：Module 内部纯重构、局部 JSX/CSS、测试 helper、文案和不改变拓扑的内容数据。若无法判断，开发任务只上报：

```text
NEEDS_MASTER_CHANGE=ARCHITECTURE:<observed change>:<required contract>
```

图、合同与源码证据冲突时立即停止并登记：

```text
ARCHITECTURE_DRIFT=<diagram fact>:<observed code/contract>:<blocking impact>
```

## 复验命令

Archify 必须以用户级 Skill 安装，版本固定为 `v2.16.0`。安装在默认 Codex 目录时，可在 PowerShell 运行：

```powershell
node "$env:USERPROFILE\.codex\skills\archify\bin\archify.mjs" validate architecture "docs\architecture\runtime.archify.json" --quality showcase --repo-root . --json
node "$env:USERPROFILE\.codex\skills\archify\bin\archify.mjs" deliver architecture "docs\architecture\runtime.archify.json" "docs\architecture\runtime-architecture.html" --quality showcase --repo-root . --json
$env:ARCHIFY_CHROME = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
node "$env:USERPROFILE\.codex\skills\archify\bin\archify.mjs" visual-check "docs\architecture\runtime-architecture.html" --json
```

`validate/deliver` 证明类型化规格、源码证据和产物检查；`visual-check` 只证明限定浏览器尺寸下的 containment、可读性与截图采集；人工视觉审查仍单独记录。
