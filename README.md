# 诡秘之主同人游戏 · 0.212.0 阶段版

基于《诡秘之主》设定的原创角色单机 RPG，使用 React、TypeScript、Vite 和 Electron/SQLite。按周工作、学习、调查与休养，取得魔药，在有限故事与战斗中成长。

## 当前范围

- 22条途径均有9→2有限可玩切片及有限序列1实现。
- 已有愚者、红祭司、空想家、完美者、月亮五条有限序列0实现。愚者、红祭司、空想家、月亮已有自然晋0实路；完美者自然续行以服药失败死亡结束，成功晋升与尾声另经明确控制一次新骰的独立验证。
- 其余17条序列0与完整1.0仍未完成。门、银骑士部分高阶验证使用定向起点，不能据此认定全路线自然通关。

当前分支为 `feature/0.212.0-moon`。本阶段本地定点验收已完成，未合并main；远端Windows检查以本分支的实际Actions终值为准，可见Electron窗口、桌面实机体验和安装包尚未完成本阶段验收。

## 安装和启动

使用 Node.js 24.15–24.x、npm和图形桌面。检出本阶段分支时保留仓库行尾属性，历史输入与源码按原始字节校验。首次安装、首次下载Electron 44运行时需要网络；也可预先执行 `npx --no-install install-electron`。

```sh
npm ci
npm run build
npm start
```

浏览器开发运行 `npm run dev:renderer`，Electron桌面开发运行 `npm run dev`。浏览器内存试玩不是持久存档，桌面版使用SQLite。云环境测试不代替可见桌面试玩；当前构建仍有大分块警告。

## 0.212.0：月亮三站夜航

从美神阶段原670条命令的活截点，按原种子继续254条，共924条。原三次晋1失败保留；此后为同一原特性付费重配五个普通载体，前四次失败、第五次成功，累计第八次服药晋1。全程只沿用原三份特性。旧912条路线包含九份独立来源特性的历史，仍可读取，但不自动折算为这条路线的三份原件。

三站六名原乘客实际抵岸，另两份原特性和唯一原件完成交接后，第903条命令、第207周首次服用月亮魔药，以70%成功率掷12晋0。事故中“月照航道”掷93失败，“柔和渡行”掷55成功但在转移前到期，两项新掌握均为0；原船员借原缆绳、付费灯油和普通划船，实际转移两名原乘客并交接。最终第211周仍为ACTIVE、序列0，健康92、精神83、灵性128、现金2996便士、0行动，一处轻伤、风险1。没有重抽或补施。

原捕获冻结版本已完成26/26个选定唯一SQLite转换，以及完整254条新增命令的逐态重放和3个真实SQLite代表转换。随后真实终态界面检查发现旧生命给予者战斗的内部字段泄漏。仅修正两个源文件的公开字段白名单后，五个关键状态的旧/新完整全局公开结果精确差分通过；修后完整254条的私态、随机与原章节公开hash逐步一致，每步全局公开敏感字段检查通过，最终第924条的真实SQLite代表也通过。另有4项公开边界测试、1项真实终态界面测试、59项Node契约检查、只读预检、严格类型和生产构建通过。原26次专项事务未在修后重新执行；最终定点与受影响历史回归去重59个文件、834项断言通过，失败和未完成均为0；其中部分冻结前结果明确保留，不冒充最终全树重跑。最终严格main/完整renderer类型检查和生产构建通过，4,423份运行冻结成员重新逐字节核等。

玩法与原创边界见[月亮阶段记录](docs/MOON_PLAYABLE_STAGE.md)，验收范围和复验命令见[月亮验收说明](docs/MOON_RELEASE_ACCEPTANCE.md)。完美者的自然死亡与受控成功分别见[完美者阶段记录](docs/PERFECTER_PLAYABLE_STAGE.md)。

## 测试与完整输入

历史原始输入以完整文件压缩包交付，包数、体积、文件数与SHA256以 `test-inputs/manifest.json` 为准。恢复器拒绝不安全路径、损坏包和不同内容覆盖；可以安全重试。三个短烟测的原输入直接随源码提供。

```sh
npm run typecheck
npm run test:smoke
npm run test:fixture-restore
npm run fixtures:check
```

全量历史测试前恢复完整输入，并按清单预留展开空间：

```sh
npm run fixtures:restore
npm test -- --exclude tests/domain/catastrophe-shared.test.ts --exclude tests/domain/wisdom-angel-life.test.ts --maxWorkers=1 --no-file-parallelism
npm run test:catastrophe-isolated
npm run test:wisdom-angel-life-isolated
```

本云环境的天灾共享、智慧天使生活测试曾在整文件运行时出现worker异常退出。两个隔离命令分别核对原15项、33项完整名单，逐项在独立进程执行，失败、漏项或异常退出均返回非零。`npm run check`仍调用默认整文件测试，受同一限制；上列命令是复验方法，不表示0.212.0已完成全部历史测试。本阶段智慧天使生活33项已实际隔离通过；天灾共享15项保留既有验证，本阶段未重跑。

可按需恢复原有输入，例如：

```sh
npm run fixtures:restore -- --only-prefix life-giver-v01680 --only-prefix beauty-goddess-v01900
```

月亮输入已打包：34份完整捕获文件加5份原特性回收测试输入，共39份、15,963,887字节。公共恢复器已在独立目录实际恢复全部39份，文件集合一致，逐字节比对原件通过。

包为 `test-inputs/lotm_release_0.212.0_moon_test_inputs_1_2026-10-17.tar.gz`，13,926,765字节；SHA256为 `07ef444eecdfc17ee4f735f80ceb7a835ef3eeb55f700ed3aba32d993a13cc4e`。按需恢复本阶段输入：

```sh
npm run fixtures:restore -- --only-prefix moon-v02120 --only-prefix beauty-recovery-components
```

最终定点汇总为59个唯一文件、834项断言，另有59项Node契约；类型、构建、完整输入恢复均通过。此结果没有重跑全仓库1,333个测试文件。阶段提交与远端检查见当前分支及其PR。本阶段Windows、可见Electron窗口、桌面实机体验与安装包仍未验收。

历史验证范围见[既有发布验收说明](docs/RELEASE_ACCEPTANCE.md)及各阶段说明；历史通过记录不替代本阶段复验。

## 来源与许可

仓库不包含小说全文、个人存档、凭据、node_modules或生成测试输出。原创代码许可及第三方设定、素材权利分别见LICENSE、NOTICE和 `public/assets/ART_SOURCES.txt`。源码、游戏资源和完整测试输入按明确清单交付。
