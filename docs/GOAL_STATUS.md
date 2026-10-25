# Voyager Goal Status

## 2026-07-19 开发基线

- 分支与上游：`main...origin/main`，当前没有领先或落后提交。
- 当前 HEAD：`9f557419c6cd9f418e82dff03a148b7f20c66962`（`9f55741`，`Add v0.3.0 release workflow`）。
- 当前版本：`manifest.json` 与 `package.json` 均为 `0.3.0`；最新正式版本标签为 `v0.3.0`，标签对象 `03f475e`，HEAD 位于该标签之后。
- 产品阶段：阶段 0“锁定并发布稳定基线”；退出门槛尚未满足，不得开始阶段 1。
- 本文从 S0-01 基线交接继续维护到当前阶段 0 进度；S0-03 自动化前置已完成，真实 ChatGPT 与 Word/WPS 验收仍未完成。

## 工作区保护基线

当前没有暂存改动。以下包含进入 S0-01 前已经存在的本地改动，以及阶段 0 自动验证为保护这些改动新增的夹具修复；均不回退、不擅自暂存或提交：

| 分类 | 文件与状态 | 基线判断 |
| --- | --- | --- |
| 业务实现 | `src/content/content.js`、`src/content/content.css` | 官方导航可读条目同步、问题模式 PDF/PNG 等实现候选；待真实页面验收 |
| 自动检查与夹具 | `scripts/check-export-question-regression.js`、`scripts/check-navigation-core-fixture.js`、`tests/navigation-core-fixture.js`、`scripts/run-navigation-browser-fixture.js`、`package.json` | 静态检查与本机 headless Chrome 三场景均已通过；真实 ChatGPT 行为仍待人工验收 |
| 产品与验收文档 | `README.md`、`docs/MANUAL_TEST_CHECKLIST.md`、`docs/VOYAGER_MVP_SPEC.md`、`docs/VOYAGER_PLAN.md` | 已随当前候选实现更新；不能当作行为已验收证据 |
| 历史与状态记录 | `REGRESSION_LOG.md`、`docs/GOAL_STATUS.md` | 已记录高速 Chrome 夹具的初始化时序误报、聚合计数误报和实际验证结果 |
| 未跟踪项 | `.workbuddy/`、`代码.txt` | 用途未确认；不删除、不修改、不纳入发布 |

盘点时 `git diff --stat` 为 11 个跟踪文件、968 行新增、278 行删除。该数字包含进入本任务前已有的 `docs/GOAL_STATUS.md` 改动；S0-01 完成后的最终统计可能随本文件重写变化，不能据此推断其他文件被改动。

## 当前已实现能力（代码/文档证据）

- 识别常见 ChatGPT turn 与直接 user-role DOM，维护问题索引、目录搜索、实时采集、深度采集、缓存恢复和会话隔离。
- 目录保留已记录问题；弱锚点通过验证式定位并在失败时给出状态，不把不可定位问题静默隐藏。
- 重复文本与长前缀相同问题使用稳定身份，避免不同 turn 被合并；异步定位保留 DOM 重绘防线。
- 不绘制 Voyager 第二套右侧问题横线，保留 ChatGPT 官方导航；当前候选实现可读取官方导航暴露的可复制标题并补入问题索引，但不接管官方点击或滚轮。
- 对当前已加载 assistant 回复生成本地提取式“一句话概览”；不宣称为 AI 语义总结。
- 导出页区分“问题”和“对话”：问题模式基于已记录问题索引，支持 Markdown、PDF、PNG；对话模式只导出当前已加载消息，不宣称包含未加载回答。
- 公式复制包含 Word UnicodeMath、WPS LaTeX、Markdown LaTeX 和原始 LaTeX 路径；WPS 路径已有断裂命令、文本样式命令和单行输出防线。
- 默认本地处理，不增加外部对话上传或新权限。

以上“已实现”只表示当前工作区存在代码、静态检查或夹具证据，不等于真实 ChatGPT/Word/WPS 行为已经通过。

## 验证状态

### 已有证据

- 历史记录显示既有静态回归、JavaScript 语法检查和本地导航夹具曾通过；这些记录用于保护边界，不能替代当前工作区重跑。
- S0-01 已核对 `AGENTS.md`、`REGRESSION_LOG.md`、`docs/VOYAGER_PLAN.md`、`docs/VOYAGER_MVP_SPEC.md`、原 `docs/GOAL_STATUS.md`、`docs/MANUAL_TEST_CHECKLIST.md`，以及当前 Git 状态、diff、提交和标签。
- S0-01 使用 `rg` 核对了阶段 0 范围、P0 入口、`package.json` 的 `npm run check` 链和相关实现/回归脚本入口。
- S0-02 在保护全部未提交改动的前提下顺序运行 `npm run check`、`npm run build`、`git diff --check`，三项退出码均为 0。`npm run check` 及构建内再次执行的完整检查均通过回归日志门禁、目录/一句话概览/导出/导航夹具/官方导航/公式复制静态回归和主要 JavaScript 语法检查。
- S0-02 核对 `scripts/build-dist.js`：构建会重建被 `.gitignore` 忽略的 `dist/`，复制 `manifest.json`、`README.md`、`NOTICE.md`、`package.json`、完整 `src/` 与 `assets/`。本次构建输入和 `dist/` 均为 23 个文件，逐文件 SHA-256 比较为 0 缺失、0 不一致、0 额外文件。
- S0-02 已确认 `dist/` 中存在 Manifest、content/background/shared、popup/options、formulaCopy、相关样式、hero 资源和 16/32/48/128 图标；关键源码与对应产物二进制一致，可作为 S0-03 待加载候选。
- S0-02 命令前后 `git status` 与 `git diff --stat` 一致：仍为原有 11 个跟踪文件改动（977 行新增、284 行删除）及未处理的 `.workbuddy/`、`代码.txt`，没有暂存改动，也没有因构建产生新的跟踪改动。
- S0-03 自动化前置新增 `npm run check:browser-fixture`：使用本机 headless Chrome 和隔离配置顺序运行 basic、virtualized、restore。basic 10 个、virtualized 4 个、restore 3 个功能断言全部 PASS，三个场景均无未捕获运行时错误；restore 与 virtualized 共用配置，覆盖缓存恢复连续性。
- 完成上述夹具修复后，`npm run check:regression-log`、`npm run check`、`npm run build` 和 `git diff --check` 再次全部通过，`dist/` 已按当前工作区重建；仅有既有 LF/CRLF 转换提示。
- 已建立 `docs/STAGE0_ACCEPTANCE.json` 与独立门禁 `npm run check:stage0-acceptance`：固定 M-01 至 M-12 和 20 个 Word/WPS 公式语料，自动校验版本、记录结构和当前转换输出。当前真实状态为 ChatGPT 2/12 PASS（其余 M-03 至 M-12 BLOCKED）、Word 0/20、WPS 0/20，发布门禁明确为 PENDING。
- 固定公式语料发现并修复了 Word UnicodeMath 复合分数丢失括号、文本函数破坏为 `\\mathrmhead` 的问题；矩阵和分段函数尚未宣称兼容，已作为必须在真实 Word/WPS 中记录结果或限制的用例。
- 公式修复后重新运行 Chrome 三场景、完整检查和构建，全部通过；最终 20 公式提示生成数量为 20，`dist/` 与 23 个构建输入逐文件 SHA-256 比较为 0 缺失、0 不一致、0 额外文件。

### 当前仍未验证

- `docs/MANUAL_TEST_CHECKLIST.md` 的 M-01 至 M-12 尚无本轮全部 PASS 的真实 Chrome 证据。
- 官方导航在真实 ChatGPT 页面是否暴露可读标题，以及同步后的数量、顺序、重复问题身份和非干扰行为，仍需人工验证。
- 问题模式 PDF 打印预览、PNG 下载、长内容限制提示，以及对话模式完整性边界，仍需真实页面验证。
- 短/长对话、重复问题、虚拟滚动、刷新恢复、会话切换、新建会话转持久会话、深度采集取消与滚动位置恢复，仍需真实页面验证。
- 至少 20 个代表性公式在真实 Word/WPS 中的通过结果或明确兼容限制尚未形成验收记录。
- 从重新生成的 `dist/` 加载扩展并完成行为验收尚未执行。

## 历史回归边界

- `2026-05-27 - 滑轨滚轮向下滚动回弹`：不得恢复自绘滑轨或重新拦截官方导航滚轮。
- `2026-05-29 - 三横线目录只显示部分问题`：目录必须保留全部已记录问题，不能只依赖当前可见 DOM 或强锚点。
- `2026-06-15 - 删除无效且冗余的总结提示词流程`、`回答预览只截取开头`：辅助信息必须称为“一句话概览”，不得冒充 AI 总结。
- `2026-06-15 - 相同或长前缀相同的问题被目录和滑轨合并`：目录、缓存、定位和导出必须继续使用稳定问题身份。
- `2026-06-16 - 插件横线与 ChatGPT 官方问题导航重复`：不得恢复 Voyager 第二套横线，不得接管官方导航点击和滚轮。
- `2026-06-16 - 导出菜单只识别当前已加载的 24 条消息`：问题索引可来自缓存/采集；对话和回答完整性仍必须以实际加载为边界。
- `2026-06-16 - WPS LaTeX 公式复制输出断裂命令`、`WPS LaTeX 不接受文本样式命令`：不得恢复断裂命令、WPS 不稳定文本样式命令或多行输出。
- `2026-06-21 - 导出问题索引未复用官方可读导航条目`：只能读取官方可复制标题，不得把不可读 marker 伪造成问题正文。
- `2026-06-22 - 问题模式下 PDF 和图片导出按钮不可点击`：问题模式必须允许导出所选问题清单；不得借此声称未加载回答已导出。

## 阶段 0 四个顺序任务

1. **S0-01 更新开发基线（本任务）**：核对 Git、代码、文档、历史回归与测试入口，只更新本状态文档。状态：已完成；`npm run check` 与 `git diff --check` 通过，仅有现有 LF/CRLF 转换警告。
2. **S0-02 建立自动检查与构建基线（本任务）**：状态：已完成。`npm run check`、`npm run build`、`git diff --check` 均通过；`dist/` 23 个文件与当前构建输入逐文件 SHA-256 一致，必要入口齐全；命令前后 Git 状态一致。唯一非阻塞警告为现有改动文件的 LF/CRLF 转换提示。
3. **S0-03 执行真实 Chrome P0 验收**：状态为进行中。自动化前置已经通过本机 Chrome 的 basic 10 项、virtualized 4 项、restore 3 项和三组运行时错误检查；下一步必须从当前 `dist/` 重新加载扩展，按 M-01 至 M-12 记录真实 ChatGPT 的 PASS/FAIL/BLOCKED 证据。发现缺陷时按防回归流程另行处理。
4. **S0-04 完成公式与发布候选验收**：验收工具准备已完成，但执行仍须等待 S0-03 全部 PASS。届时在 Word/WPS 记录固定 20 个公式结果，汇总已知限制，运行 `npm run check:stage0-acceptance -- --require-complete`，再复核阶段 0 全部退出门槛并形成 `v0.3.1` 发布候选结论；门槛未满足则保持阶段 0。

顺序约束：S0-01 → S0-02 → S0-03 → S0-04。后续任务必须重新读取当前工作区状态，不得把本文的实现候选描述当作实时测试结果。

## S0-03 直接交接范围

S0-03 应直接使用 2026-07-19 最后一次 `npm run build` 重新生成的 `dist/`，在 Chrome 扩展页重新加载后按 `docs/MANUAL_TEST_CHECKLIST.md` 执行 M-01 至 M-12。必须记录 Chrome 版本、加载来源、测试对话、规模和 PASS/FAIL/BLOCKED 证据，重点覆盖官方导航非干扰、目录完整性与重复问题身份、缓存/会话隔离、深度采集取消和滚动恢复、问题/对话模式 Markdown/PDF/PNG 边界。动态本地夹具虽已通过，但没有使用真实 ChatGPT DOM、账号会话、下载/打印交互或目标办公软件，不能替代 S0-03 行为验收与 S0-04 Word/WPS 公式验收。开始人工验收前仍需保护当前全部未提交改动，不得清理 `.workbuddy/` 或 `代码.txt`。

### 2026-08-11 续测阻塞证据

- 已重新连接真实、已登录的 Chrome；当前可见标签为 `https://chatgpt.com/` 空白新聊天，没有现成的 30+ 用户问题对话。
- Chrome 自动化的 URL 安全策略拒绝进入 `chrome://extensions`。因此无法在不绕过安全策略的前提下重新加载当前 `dist/`；本轮没有把未知加载版本的扩展当作验收对象。
- 没有发现可归因于 Voyager 的真实产品缺陷，不能仅凭控制策略和测试数据缺失创建修复或修改业务代码。
- `docs/STAGE0_ACCEPTANCE.json` 已保留 M-03 至 M-12 为 `BLOCKED` 并写入本轮证据。恢复验收前，需要用户在 Chrome 的扩展管理页手动从 `C:\\Users\\sp202\\Documents\\New project\\dist` 重新加载扩展，并提供或准备至少 30 个用户问题的已保存 ChatGPT 对话；之后从 M-03 继续，不进入 S0-04。
