# 诡秘之主同人游戏 · 0.216.0 阶段候选

基于《诡秘之主》设定的原创角色单机 RPG，使用 React、TypeScript、Vite 和 Electron/SQLite。按周工作、学习、调查与休养，取得魔药，在有限故事与战斗中成长。

## 当前范围

- 22条途径均有9→2有限可玩切片及有限序列1实现。
- 已有愚者、红祭司、空想家、完美者、月亮、黑暗、白塔、暴君、太阳九条有限序列0实现。愚者、红祭司、空想家、月亮、黑暗、白塔、太阳七条自然晋0实路保持；完美者自然线服药失败死亡，本次暴君自然线在独自挑战太阳神时死亡、未晋0。两者成功分支另由独立受控用例验证。
- 其余13条序列0与完整1.0仍未完成。门、银骑士部分高阶验证使用定向起点，不能据此认定全路线自然通关。

当前分支为 `feature/0.216.0-sun`。太阳自然、保存与旧相关回归已完成，独立输入恢复、最终严格类型与生产构建已通过，尚未上传本候选，main尚未合并阶段开发；远端PR、CI与Windows检查须以对应提交的实际记录及终值为准。可见Electron窗口、桌面实机体验、安装包及玩家验收尚未进行。

## 安装和启动

使用 Node.js 24.15–24.x、npm和图形桌面。检出本阶段分支时保留仓库行尾属性，历史输入与源码按原始字节校验。首次安装、首次下载Electron 44运行时需要网络；也可预先执行 `npx --no-install install-electron`。

```sh
npm ci
npm run build
npm start
```

浏览器开发运行 `npm run dev:renderer`，Electron桌面开发运行 `npm run dev`。浏览器内存试玩不是持久存档，桌面版使用SQLite。云环境测试不代替可见桌面试玩；当前构建仍有大分块警告。

## 0.216.0：太阳与街区停炉

从纯白天使原853条命令后的活终态沿同一随机流继续81条，共934条。本人已融合的原份、实际交接的另两份与同一唯一性守恒；完成两件居民服务并真实等满晋1后十二周，第923条、第214周首次服药，以74%成功率掷57晋0。

尾声定向光热以70%掷14成功，下一真实操作清除四份有限非生物残留，掌握增至8；温热护持以70%掷95失败，留下8点健康损耗与一处轻伤，掌握仍0。随后普通停炉封闭、实际步行退出并报告。终态第215周仍为ACTIVE、序列0，健康92、精神64、灵性38/150、现款36便士、0行动，原伤势与失败成本保留。

原捕获冻结下34个唯一SQLite转换通过。随后修正中央公开资源上限与普通行动禁用状态，81条命令私态与随机逐态一致，公开变化严格限于三字段及其12个既有恢复区派生字段；修后11项完整回放检查、2个真实保存代表及7项捕获界面检查通过。本地去重38个完整文件621项通过，另3项迁移聚焦与24项脚本合同。完整证据与尚待项目见[太阳验收说明](docs/SUN_RELEASE_ACCEPTANCE.md)，玩法与原著边界见[太阳阶段记录](docs/stages/0216-sun.md)。

本阶段输入及原来源可按专用清单恢复，原始853条历史字节和哈希保持：

```sh
node test-inputs/restore-test-inputs.mjs --manifest test-inputs/sun216-required-inputs.manifest.json
npm test -- tests/domain/sun-natural.test.ts --maxWorkers=1 --no-file-parallelism
npm test -- tests/backend/sun-capture-save.test.ts --maxWorkers=1 --no-file-parallelism
npm test -- tests/renderer/sun-captured-result.test.tsx --maxWorkers=1 --no-file-parallelism
```

## 0.215.0：暴君重建候选

从公开0.214.0基线重新实现；此前执行环境丢失的未上传215源码与证据未恢复，旧摘要不计本次验收。从原701条命令后的合法活态沿原随机流继续163条，第717条回收原第1份特性重新调配晋1，三岸当前共同追随者达到270000。第864条在太阳神挑战第9次敌对交换中死亡，终态为195周、序列1、健康0；未满足生还条件、未晋0。原失败、费用、伤势与随机结果全部保留。

最终运行下163条新增动作的13项完整回放、717检定显示的25项测试、4个实际SQLite代表、6项捕获界面、严格类型和生产构建已通过。原28唯一SQLite边界的完整验收保留；显示修正后没有重复声称全28新跑。相关去重证据为57个完整文件853项（含20文件287项保留回执），另3项迁移聚焦；未重复全游戏历史测试。完整范围、恢复与限制见[暴君验收说明](docs/TYRANT_RELEASE_ACCEPTANCE.md)和[阶段记录](docs/stages/0215-tyrant-rebuild.md)。

本阶段聚焦复验需原193四包与新215十五包。使用组合清单完整恢复依赖；它不覆盖全部历史回归：

```sh
node test-inputs/restore-test-inputs.mjs --manifest test-inputs/tyrant215-required-inputs.manifest.json
npm test -- tests/domain/tyrant-natural.test.ts --maxWorkers=1 --no-file-parallelism
npm test -- tests/backend/tyrant-capture-save.test.ts --maxWorkers=1 --no-file-parallelism
npm test -- tests/renderer/TyrantCapture.test.tsx --maxWorkers=1 --no-file-parallelism
```

## 0.214.0：白塔通路与机械闸

从全知之眼原666条命令后的活态沿同一随机流继续137条，共803条；原666条完整来源保留，本轮没有重新执行全部旧历史。三位居民实际走完各自通路并于下一真实周复核；第三处施工大失败后保留耗材、伤势与撤回许可，另购唯一备用包普通修复。本人已容纳的一份与实际交接的另两份原特性、同一唯一性组成三加一，第775条、第170周首次服药，以70%成功率掷34晋0。

尾声结构洞察实际帮助独立核验，掌握增至8；对手重构使旧窗口失效。有限弱处掷96大失败，留下本人未治疗重伤与瑟拉擦伤，掌握仍为0。重新取得同意后，双方经普通机械操作和真实同行抵达十二米安全出口。最终第174周仍为ACTIVE、序列0，健康84、精神77、灵性122/150、现款0便士、欠款80便士、1行动；伤势保留，两项掌握8/0。

137条新增命令四段连续逐态重放、26/26个选定唯一SQLite转换、3项真实保存代表与4项捕获界面检查通过。最终55个完整测试文件范围776项、另2项仅选定聚焦检查、66项Node合同、严格类型与生产构建通过；4,500个运行冻结成员逐字节一致。8个输入包已独立完整恢复并核验148个成员及142个内层gzip。范围与限制见[白塔验收说明](docs/WHITE_TOWER_RELEASE_ACCEPTANCE.md)，玩法与原创边界见[白塔阶段记录](docs/WHITE_TOWER_PLAYABLE_STAGE.md)。

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

本云环境的天灾共享、智慧天使生活测试曾在整文件运行时出现worker异常退出。两个隔离命令分别核对原15项、33项完整名单，逐项在独立进程执行，失败、漏项或异常退出均返回非零。`npm run check`仍调用默认整文件测试，受同一限制；上列命令是复验方法，不表示0.214.0已完成全部历史测试。本阶段智慧天使生活33项已按完整名单逐项独立执行并全部通过，计入55个完整文件范围；天灾共享15项本地未重跑。本阶远端CI结果仍待发布后核实。

可按需恢复原有输入，例如：

```sh
npm run fixtures:restore -- --only-prefix life-giver-v01680 --only-prefix beauty-goddess-v01900
```

白塔本阶段8个完整输入包共137,236,894字节，独立恢复148份文件共138,951,275字节（147份原捕获加1份完整性清单）；完整集合、逐字节/SHA及全部142个内层gzip原始内容均已核验。[白塔输入描述文件](test-inputs/white-tower-v02140-inputs.json)列出全部包与成员hash，其SHA256为`f612edace067e88be660f07c65cf2b449e00665bbbf351eccd9d4fbd40c1cf89`；[各包大小与SHA256](docs/WHITE_TOWER_RELEASE_ACCEPTANCE.md#公开输入与复验)见验收说明。恢复本阶段与原来源后可运行对应测试：

```sh
node test-inputs/restore-test-inputs.mjs --manifest test-inputs/white-tower-v02140-inputs.json
npm run fixtures:restore -- --only-prefix all-knowing-eye-v01920
```

独立恢复可添加`--destination white-tower-restored`；此参数是fixtures根目录，直接生成其下的`white-tower-v02140/`及同级完整性清单，不是仓库根目录。运行测试仍使用默认`tests/fixtures`位置。

此前黑暗输入已打包：34份完整捕获文件，共10,601,189字节。公共恢复器已在独立目录实际恢复全部34份，文件集合一致，逐字节及各gzip原始内容比对通过。

包为 `test-inputs/lotm_release_0.213.0_darkness_test_inputs_1_2026-10-17.tar.gz`，9,950,211字节；SHA256为 `9c2b94d4eab29e7a1cdaa5dd3db081b7792847b456facb607c32996542f3702d`。按需恢复黑暗阶段输入与原来源：

```sh
npm run fixtures:restore -- --only-prefix misfortune-knight-v01910 --only-prefix darkness-v02130
```

本地结果属于本阶段定点及受影响回归，未将全部历史测试重新运行一遍。本阶远端CI与Windows以对应提交的实际终值为准；可见Electron窗口、桌面实机体验、安装包及玩家验收仍为NOT_RUN。

历史验证范围见[既有发布验收说明](docs/RELEASE_ACCEPTANCE.md)及各阶段说明；历史通过记录不替代本阶段复验。

## 来源与许可

仓库不包含小说全文、个人存档、凭据、node_modules或生成测试输出。原创代码许可及第三方设定、素材权利分别见LICENSE、NOTICE和 `public/assets/ART_SOURCES.txt`。源码、游戏资源和完整测试输入按明确清单交付。
