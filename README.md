# 诡秘之主同人游戏 · 0.213.0 阶段版

基于《诡秘之主》设定的原创角色单机 RPG，使用 React、TypeScript、Vite 和 Electron/SQLite。按周工作、学习、调查与休养，取得魔药，在有限故事与战斗中成长。

## 当前范围

- 22条途径均有9→2有限可玩切片及有限序列1实现。
- 已有愚者、红祭司、空想家、完美者、月亮、黑暗六条有限序列0实现。愚者、红祭司、空想家、月亮、黑暗已有自然晋0实路；完美者自然续行以服药失败死亡结束，成功晋升与尾声另经明确控制一次新骰的独立验证。
- 其余16条序列0与完整1.0仍未完成。门、银骑士部分高阶验证使用定向起点，不能据此认定全路线自然通关。

当前分支为 `feature/0.213.0-darkness`。本阶段本地定点验收已完成，未合并main；远端Windows检查以本分支的实际Actions终值为准，可见Electron窗口、桌面实机体验和安装包尚未完成本阶段验收。

## 安装和启动

使用 Node.js 24.15–24.x、npm和图形桌面。检出本阶段分支时保留仓库行尾属性，历史输入与源码按原始字节校验。首次安装、首次下载Electron 44运行时需要网络；也可预先执行 `npx --no-install install-electron`。

```sh
npm ci
npm run build
npm start
```

浏览器开发运行 `npm run dev:renderer`，Electron桌面开发运行 `npm run dev`。浏览器内存试玩不是持久存档，桌面版使用SQLite。云环境测试不代替可见桌面试玩；当前构建仍有大分块警告。

## 0.213.0：黑暗长夜撤离

从厄难骑士原679条命令的和平活态，按同一随机流继续155条，共834条；另一路694条死亡历史完整保留。四位原居民实际走到安全屋，两份失败原特性调查并隔周交接，唯一性真实保管链核清后，第814条、第189周首次服用黑暗魔药，以70%成功率掷50晋0。全程只沿用三份原特性，未生成第四份。

尾声短隐秘掷31成功，但普通锁定悬物时窗口过期；有限厄难偏导掷85失败。两名原居民随后沿普通侧路实际撤出，两项新掌握均为0。最终第192周仍为ACTIVE、序列0，健康92、精神83、灵性128、752便士、1行动，一处未治轻伤、风险1；没有重抽或补施。

155条新增命令的四连续块逐态私态、随机、章节及全局公开核验通过；22/22个选定唯一SQLite转换与3个实际保存代表通过，真实晋0回执即显、失败与最终报告的3项UI测试通过。53个完整测试文件826项、另1项聚焦回归、58项脚本合同及严格类型/生产构建通过；完整结果见[黑暗验收说明](docs/DARKNESS_RELEASE_ACCEPTANCE.md)。玩法与原创边界见[黑暗阶段记录](docs/DARKNESS_PLAYABLE_STAGE.md)。此前月亮与完美者各自结果仍见[月亮](docs/MOON_RELEASE_ACCEPTANCE.md)及[完美者](docs/PERFECTER_PLAYABLE_STAGE.md)阶段记录。

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

本云环境的天灾共享、智慧天使生活测试曾在整文件运行时出现worker异常退出。两个隔离命令分别核对原15项、33项完整名单，逐项在独立进程执行，失败、漏项或异常退出均返回非零。`npm run check`仍调用默认整文件测试，受同一限制；上列命令是复验方法，不表示0.213.0已完成全部历史测试。本阶段本地未重跑这两组隔离全集，保留既有结果；远端CI继续执行完整名单。

可按需恢复原有输入，例如：

```sh
npm run fixtures:restore -- --only-prefix life-giver-v01680 --only-prefix beauty-goddess-v01900
```

黑暗输入已打包：34份完整捕获文件，共10,601,189字节。公共恢复器已在独立目录实际恢复全部34份，文件集合一致，逐字节及各gzip原始内容比对通过。

包为 `test-inputs/lotm_release_0.213.0_darkness_test_inputs_1_2026-10-17.tar.gz`，9,950,211字节；SHA256为 `9c2b94d4eab29e7a1cdaa5dd3db081b7792847b456facb607c32996542f3702d`。按需恢复本阶段输入与原来源：

```sh
npm run fixtures:restore -- --only-prefix misfortune-knight-v01910 --only-prefix darkness-v02130
```

本地结果属于本阶段定点及受影响回归，未将全部历史测试重新运行一遍。本阶段Windows、可见Electron窗口、桌面实机体验与安装包仍未验收。

历史验证范围见[既有发布验收说明](docs/RELEASE_ACCEPTANCE.md)及各阶段说明；历史通过记录不替代本阶段复验。

## 来源与许可

仓库不包含小说全文、个人存档、凭据、node_modules或生成测试输出。原创代码许可及第三方设定、素材权利分别见LICENSE、NOTICE和 `public/assets/ART_SOURCES.txt`。源码、游戏资源和完整测试输入按明确清单交付。
