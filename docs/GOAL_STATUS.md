# Voyager Goal Status

## 当前状态

- 基准日期：2026-06-15
- 分支：`main`
- 上游状态：`main...origin/main`，当前 HEAD 为 `e1e3e66`
- 产品状态：v0.3.0 发布候选，P0 导航核心自动化基线已通过，真实 ChatGPT 页面待人工验证
- 当前活动 Goal：验证并稳定当前 Voyager 导航基线（自动化与缺陷修复完成，真实页面人工验证已移交）
- 本次工作范围：只处理问题识别、目录、官方右侧横线导航共存、插件菜单入口、定位、缓存恢复、深度采集和相关性能风险

## 已完成事项

- 已阅读并综合 `AGENTS.md`、`REGRESSION_LOG.md`、README、Manifest、package scripts、内容脚本、后台、共享存储、Popup、Options、公式模块、导出逻辑和现有检查脚本。
- 已盘点当前暂存区、未暂存区和未跟踪文件。
- 已确认当前架构为 Manifest V3、本地存储、无运行时第三方依赖、无外部 AI API。
- 已确认当前内容脚本同时承担 DOM 适配、索引缓存、定位、UI、一句话概览和导出等多项职责。
- 已确认独立提示词式“总结”流程已从当前工作区移除，目录辅助信息当前命名为“一句话概览”。
- 2026-06-15 已运行 `npm run check`，结果通过。
- 2026-06-15 已运行 `git diff --check`，结果通过；Git 输出了现有文件的 LF/CRLF 转换警告，但没有 diff check 错误。
- 已新增本地导航核心夹具，真实加载当前 `src/content/content.js`，用于可重复验证普通对话、重复问题、DOM 替换、实时新增、菜单入口、目录定位、虚拟化、深度采集和缓存恢复。
- 已修复不同 turn 的相同文本或前 300 字相同问题被文本哈希合并的问题，并修复异步点击定位后访问失效 `event.currentTarget` 的运行时错误。
- 已修复虚拟化窗口扫描序号复用时，已知 turn 仍可能跨 turn 回退匹配 element key 的边界。
- 已减少深度采集每步的重复固定等待并扩大到 0.9 个视口步长，同时保留 10% 视口重叠；60 问题虚拟化夹具重新进入 45 秒验收窗。
- 2026-06-15 已在真实 Chrome 中运行最终导航夹具：基础场景 7 项、虚拟化场景 4 项、缓存恢复场景 3 项全部通过；2026-06-16 当前工作区已改为不渲染插件横线、只保留菜单入口，需重新运行夹具。
- 已明确记录真实 ChatGPT 自动化阻塞：Chrome 后端能打开真实会话，但页面 DOM 读取、只读 evaluate 和截图均在 30 秒后超时并重置内核；Windows 桌面通道因 `@oai/sky` 子路径导出错误无法启动。

## 当前工作区改动盘点

### 暂存区

| 文件 | 改动归类 | 当前验证状态 |
| --- | --- | --- |
| `AGENTS.md` | 新增防回归开发规范 | 文档已读取；未提交 |
| `REGRESSION_LOG.md` | 新增回归记录基础结构和首批流程记录 | `npm run check:regression-log` 已通过；未提交 |
| `package.json` | 接入回归日志检查 | `npm run check` 已通过；未提交 |
| `scripts/check-regression-log.js` | 检查代码改动是否同步更新回归日志 | `npm run check` 已通过；未提交 |

### 未暂存区

| 文件 | 改动归类 | 当前验证状态 |
| --- | --- | --- |
| `src/content/content.js` | 大幅扩展问题识别、缓存、虚拟化定位、实时/深度采集、菜单入口、目录、一句话概览、反馈入口和导出流程；当前不再渲染插件自绘右侧横线 | 语法、静态回归和导航夹具待本次重新验证；真实 ChatGPT 待人工验证 |
| `src/content/content.css` | 配套菜单入口、目录状态、一句话概览、采集状态、反馈和响应式样式；旧插件 rail 保持隐藏 | 静态检查和本地夹具待本次重新验证；真实 ChatGPT 视觉待人工验证 |
| `README.md` | 增加一句话概览和问题反馈说明 | 已与当前代码大体核对；不代表行为已验证 |
| `REGRESSION_LOG.md` | 增加滑轨、目录、总结/概览流程及稳定问题身份相关历史记录 | `npm run check:regression-log` 已通过；未提交 |
| `package.json` | 接入目录、一句话概览和导航夹具静态检查 | `npm run check` 已通过 |

### 未跟踪文件

| 文件 | 改动归类 | 当前验证状态或风险 |
| --- | --- | --- |
| `scripts/check-question-directory-regression.js` | 保护混合 DOM 扫描、目录完整性和稳定问题身份 | 已由 `npm run check` 执行并通过；静态检查与 Chrome 夹具相互补充 |
| `scripts/check-answer-overview-regression.js` | 保护一句话概览并禁止提示词式总结流程回归 | 已由 `npm run check` 执行并通过；仅为源码字符串静态检查 |
| `scripts/check-navigation-core-fixture.js` | 检查导航夹具覆盖范围和真实内容脚本加载 | 已由 `npm run check` 执行并通过 |
| `scripts/serve-navigation-fixture.js`、`tests/navigation-core-fixture.*` | 提供可重复的真实内容脚本浏览器场景 | 真实 Chrome 三组夹具共 14 项通过 |
| `.github/ISSUE_TEMPLATE/*` | Bug、功能建议和反馈入口模板 | 已人工读取；未做 YAML 或 GitHub 实际验证 |
| `.workbuddy/memory/2026-05-25.md` | 历史工作记忆 | 内容称当时修改已回退；不能用于描述当前工作区状态 |
| `代码.txt` | 空文件 | 用途未知；不要擅自删除或纳入产品范围 |
| `docs/*` | 本次新增的项目规格、计划、状态和手工测试文档 | 待本次文档检查完成 |

## 当前实现能力

以下能力在当前代码中存在，但“存在”不等于已经通过真实浏览器验收：

- 用户问题识别、去重和误识别过滤。
- ChatGPT 官方右侧横线导航共存、Voyager 菜单入口和目录内定位。
- 目录搜索、缓存问题状态、问题与回答配对及一句话概览。
- 实时采集、深度采集、会话缓存、备份缓存和多策略问题定位。
- Markdown 复制与下载、PDF 打印预览、PNG 分段截图导出。
- 公式提取、Word UnicodeMath、WPS LaTeX、Markdown LaTeX 和原始 LaTeX 复制。
- Popup 文件夹和快捷设置存储。
- Options 提示词库本地增删。

## 已验证与尚未验证

### 已验证

- `npm run check`：2026-06-15 通过。
- `npm run check:regression-log`：由 `npm run check` 执行并通过。
- `scripts/check-question-directory-regression.js`：由 `npm run check` 执行并通过。
- `scripts/check-answer-overview-regression.js`：由 `npm run check` 执行并通过。
- 真实 Chrome 基础夹具：历史记录为 7/7 通过；当前菜单入口改动后基础夹具应重新验证无插件重复 marker、目录数量、目录点击定位、DOM 替换、实时新增、空闲不重建重复 marker 和运行时错误检查。
- 真实 Chrome 虚拟化夹具：4/4 通过，覆盖从中间进入、向上加载更早问题、两个相同文本问题保持独立、深度采集 60/60 在 45 秒验收窗内完成，以及运行时错误检查。
- 真实 Chrome 缓存恢复夹具：历史记录为 3/3 通过，覆盖刷新后目录/右侧导航恢复、两个相同文本问题仍为两条记录、缓存首项定位和运行时错误检查；当前工作区需重新运行。
- 主要 JavaScript 文件 `node --check`：由 `npm run check` 执行并通过。
- `git diff --check`：2026-06-15 通过。

### 尚未验证

- 当前工作区在真实 Chrome 和真实 ChatGPT 页面的完整行为。
- 真实 ChatGPT 官方右侧横线导航是否不被 Voyager 菜单入口遮挡或重复绘制；本地夹具需随当前工作区重新验证无插件 marker。
- 目录是否在真实 ChatGPT 不同 DOM 结构、长对话和虚拟化场景下保持完整；普通本地夹具已通过。
- 深度采集取消和恢复原位置的真实页面边界行为；深度采集完整性与缓存重载已由夹具通过。
- 一句话概览在多条助手消息、流式回复和未加载历史消息中的准确性。
- 当前工作区的 `npm run build` 和从 `dist/` 加载后的行为。
- PDF、PNG、公式复制在真实目标应用中的兼容性。
- Popup、Options 和快捷设置的真实交互。
- Issue 模板在 GitHub 中的实际显示。
- Chrome 之外的 Chromium 浏览器。

## 已知风险

1. `src/content/content.js` 当前约 4,833 行，且本地 diff 增加约 3,864 行、删除约 630 行；改动面大，静态检查不足以证明行为稳定。
2. 当前改动同时分布在暂存区、未暂存区和未跟踪文件中，任何后续修改都必须先重新检查工作区，避免覆盖或遗漏。
3. 目录、菜单入口、缓存和定位逻辑高度耦合，修复一个入口可能重新引入历史回归。
4. 导航夹具已补足主要 DOM、滚动和异步时序场景，但真实 ChatGPT DOM 仍可能与夹具不同。
5. `panelOpen`、`autoRefresh`、`showTimeline`、`showPromptDock`、`exportFormat`、`panelPosition` 等设置主要存在于存储和 Popup，未确认内容脚本实际消费。
6. Popup 提供 JSON 默认导出选项，但当前核心导出 UI 没有 JSON 导出闭环。
7. 提示词库可以本地管理，但当前没有接入 ChatGPT 页面使用流程。
8. Manifest 只匹配 `https://chatgpt.com/*`；其他域名不在当前支持范围。
9. Manifest 和 package 版本已对齐到 `0.3.0`，计划发布标签为 `v0.3.0`；远端已有旧标签 `v0.3` 指向发布前提交，不复用或覆盖。
10. `dist/` 是忽略目录，可能与当前源码不同步；本次没有重建，以避免在仅整理文档阶段覆盖现有本地产物。

## 关键决策

- MVP 核心是长对话问题导航、目录、缓存恢复和 Markdown 复用，不以增强功能数量作为完成标准。
- 目录展示已记录问题；弱锚点目录项点击时必须通过验证式定位尝试跳转，并在失败时提示。插件不渲染第二套右侧问题横线。
- “一句话概览”是本地提取式辅助信息，不是外部 AI 语义总结。
- 在真实 Chrome 行为基线建立前，不重构 `content.js`，也不继续扩展新功能。
- 当前工作区是下一阶段验证对象，但未经验证的能力不能标记为完成。
- 默认保持本地处理，不新增外部 API 或网络请求。
- 不再把截断问题文本哈希当成问题身份；优先使用 ChatGPT turn number，缺少结构身份时才使用更弱的回退键。
- 自动化夹具必须加载真实 `src/content/content.js`，不能用测试替身重新实现导航逻辑。

## 下一步

按 `docs/MANUAL_TEST_CHECKLIST.md` 在真实 ChatGPT 页面人工执行 P0 导航用例，重点确认官方右侧横线不被插件重复绘制或遮挡、目录完整性、深度采集取消/恢复原位置和刷新恢复。自动化继续前无需新增功能。

## 阻塞项

- 真实 ChatGPT 页面自动化受阻：Chrome 后端能打开会话页，但 DOM 读取、只读 evaluate 和截图均在 30 秒后超时并重置内核；Windows 桌面通道启动时报 `@oai/sky` 子路径未从 package exports 导出。
- 尚未确认是否允许重建现有忽略目录 `dist/`。
- 空文件 `代码.txt` 和 `.workbuddy/` 属于本地辅助文件，不纳入 `v0.3.0` 发布提交；Issue 模板纳入版本控制。
