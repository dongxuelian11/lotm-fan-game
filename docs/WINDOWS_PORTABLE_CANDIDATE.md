# 0.229.0 Windows x64 便携候选（装配准备）

仅装配候选，不是正式发布或 Windows 启动验收。当前猎人退场后的成长修复仍须冻结、审查后才能选作最终游戏来源；不得把旧基线准备工作称作最终交付。

## 制作（维护者，隔离 checkout）

需要 Node 24、已按锁文件安装的依赖以及系统 `zip` / `unzip`。不引入安装器、更新器或新打包框架。先完成目标提交的类型、测试、构建和审查；以下脚本会再次从当前 checkout 构建，不接收其他工作树的 dist。

```sh
# 使用现有官方 Electron 下载脚本，内置上游校验；不运行 Windows 二进制。
node scripts/download-windows-runtime.mjs ../official-runtime-cache
# 保存同版本官方校验清单供装配复核；通过现有依赖，不安装新工具。
node --input-type=module -e 'import {downloadArtifact} from "@electron/get"; import {copyFileSync} from "node:fs"; const p=await downloadArtifact({version:"44.0.0",artifactName:"SHASUMS256.txt",isGeneric:true,cacheRoot:"../official-runtime-cache"}); copyFileSync(p,"../official-runtime-cache/SHASUMS256.txt");'
# 替换为经审查冻结的完整40位提交；输出目录必须不存在。
node scripts/assemble-windows-portable.mjs ../official-runtime-cache ../windows-candidate <完整提交SHA>
```

输出为目录、ZIP、ZIP SHA256，内含逐文件 SHA256 清单及 `windowsQA: NOT_RUN`。原官方 Electron 44.0.0 x64 运行文件与许可证全部保留，仅 exe 改名；完整运行时 dist、渲染素材/字体许可证及实际未捆绑依赖 `@noble/hashes` 保留。React 已由 Vite 捆绑。SQLite 来自 Electron 内置 Node，不安装 SQLite 原生依赖。

白名单不收源码、测试输入、小说、运行存档、DB、凭据、开发依赖或 QA 输出；应用名仍为 `lotm-fan-game`，不更改现有默认存档位置。构建源映射不交付。缓存、构建、候选输出不要提交 Git。

## 玩家启动与存档

完整解压到可读目录，双击 `lotm-fan-game.exe`；不要在压缩包内部运行或单独移动 exe。应用仍在 Windows 用户数据目录的 `lotm-fan-game` 下保存 `playable-slice.sqlite` 及备份，而不是候选文件夹内。“便携”指无需安装，不表示存档跟随程序目录。升级前退出旧版并单独备份整个存档目录；不要同时开两个版本。候选不带测试或玩家存档，不自动覆盖备份。

这是未签名候选；不要为了运行它关闭系统防护。交付渠道及大小须单独确认，生成本地 ZIP 不等于已上传、正式发行或玩家已收到。官方运行时 ZIP 本身为 157,455,369 字节（约 150.16 MiB），已超过 20 MiB 聊天附件限制；完整游戏候选须先选定可承载大文件的私有交付渠道，不能直接声称聊天可下载。分卷若使用，也不是可单独运行的安装程序。

## 仍需真实 Windows 验证

Windows 启动、中文路径、正常/大字号布局、字体/美术资源、创建角色、行动保存、退出重开与继续游戏均为 **NOT_RUN**，直到实际 Windows 执行并记录；Linux 源码构建、静态导入检查及 ZIP 哈希不代替这些证据。不能用本准备文档或历史 CI 声称当前候选验收通过。
