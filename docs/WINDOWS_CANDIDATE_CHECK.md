# 固定 85de Windows 候选自检

本说明只覆盖公开测试候选 `v0.229.0-test.20261103` 的源提交 `85de5c0a60ec179f909573c0e014b0d52c420b5e`，不是后续 421 修复版，也不是正式发行验收。

当前记录：Linux 静态 ZIP/展开目录校验通过；参数及平台拒绝测试通过。**Windows 执行、生产 GUI、人工美术和排版验收均为 NOT_RUN。** 脚本可供具备 Windows 执行条件时运行，脚本存在不代表已经执行。

## 输入与运行

从[已发布测试候选](https://github.com/dongxuelian11/lotm-fan-game/releases/tag/v0.229.0-test.20261103)取得 ZIP 并完整解压。脚本不会下载、修改或重新发布资产。不要移动单独 exe，不要关闭系统防护。需要 Node 24 执行外部检查脚本，不需要 npm install 或新测试框架。

在包含本脚本的后续源码目录，用 PowerShell 运行（替换两处本地路径）：

```powershell
node scripts/check-windows-candidate.mjs "C:\候选\lotm-fan-game-0.229.0-85de5c0-windows-x64-candidate" "C:\下载\lotm-fan-game-0.229.0-85de5c0-windows-x64-candidate.zip"
```

固定 ZIP SHA256：`a450c161f08213838c958877384f1a8ac43322a3c8579597c598b7c1720e19c1`。
脚本同时固定 manifest 哈希、源提交与清单，核对全部 1682 个文件（含 manifest），拒绝多余文件、符号链接与异常路径，结束后再校验一次。新版本需要单独审查和更新固定身份，不能绕过不匹配检查。

其他平台只允许静态核对：

```sh
node scripts/check-windows-candidate.mjs --verify-only <展开目录> <原ZIP>
node --test scripts/check-windows-candidate.test.mjs
```

## 能证明什么

Windows 模式运行候选自身 exe 的 `ELECTRON_RUN_AS_NODE` 模式，而非系统 Node 或 checkout 的编译输出。两个独立进程分别使用包内实际 SqliteSliceStore 创建合成角色、保存与关闭，再恢复公开投影并验证相同 CREATE 命令幂等重放。断言 Windows x64、Electron 44 和候选 exe 路径；每进程限时 60 秒，失败立即停止，不自动重试。

证据目录自动在系统临时目录建立，名称含中文。不接受玩家存档路径，不覆盖已有数据库，不写候选目录。失败也保留本地合成 DB、回执、日志和 summary.json，便于检查；没有自动上传。分享结果只需 summary.json 和必要日志，不上传 DB 或回执。不要把此合成数据当成真实游玩证据。

通过时仅可记录 **Windows candidate runtime / SQLite restart PASS**。RUN_AS_NODE 不启动 Chromium 界面，因此它不能证明生产 main/preload/IPC、UI 点击、字体、美术、正常或大字号排版、SmartScreen、干净机器安装或完整游玩通过。

## 单独进行真实 GUI 验收

Windows 执行者如需检查生产界面，请先关闭其他游戏版本，在全新临时目录隔离存档，切勿使用现有玩家存档：

```powershell
$qa = Join-Path $env:TEMP ("lotm-gui-" + [guid]::NewGuid().ToString())
New-Item -ItemType Directory $qa | Out-Null
$env:LOTM_TEST_USER_DATA = $qa
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
& "C:\候选\lotm-fan-game-0.229.0-85de5c0-windows-x64-candidate\lotm-fan-game.exe"
# 通过游戏窗口正常退出后，在同一 PowerShell 再运行上行以检查继续游戏。
# 全部退出后清理此终端的测试变量：
Remove-Item Env:LOTM_TEST_USER_DATA
```

记录新建角色、行动、正常退出重开和继续游戏，并分别检查正常/大字号、中文资源、图片字体与布局。每一项按实际执行记录；本脚本不会替代该人工步骤。固定 85de 的已知玩法/布局问题仍以发布说明为准，后续源码修复不在此包内。

工作流未修改；没有新增 GitHub 权限、授权刷新或 CI 运行。
