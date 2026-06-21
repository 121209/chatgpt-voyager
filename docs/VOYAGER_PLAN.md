# Voyager Development Plan

## 规划原则

- 基准日期：2026-06-15
- 计划以当前本地工作区为起点，不能假设未提交改动已经稳定。
- P0 先建立证据充分的行为基线，再允许重构或继续扩展。
- 每个功能修复都必须更新 `REGRESSION_LOG.md`，并遵守 `AGENTS.md`。
- 自动检查与真实 Chrome 验收是两类不同证据，不能互相替代。

## P0：稳定并验收当前 MVP 候选

### P0.1 建立当前工作区验证基线

目标：在不新增功能、不重构的前提下，确认当前未提交实现到底哪些可用、哪些失败。

验收条件：

- 当前工作区的暂存、未暂存和未跟踪改动已在 `docs/GOAL_STATUS.md` 中分类。
- `npm run check` 和 `git diff --check` 通过。
- 使用源码目录加载扩展，在真实 Chrome 中完成 `docs/MANUAL_TEST_CHECKLIST.md` 的全部 P0 用例。
- 每个用例记录通过、失败或阻塞，失败项附复现步骤和证据。
- 不把 PDF、PNG、公式、Popup、Options 等增强能力的未验证状态误写为完成。

验证命令：

```powershell
git status --short --branch
git diff --check
npm run check
```

真实行为验证：

```text
按 docs/MANUAL_TEST_CHECKLIST.md 执行 P0 用例
```

### P0.2 修复阻塞 MVP 的真实行为问题

目标：只修复 P0 手工验收发现的阻塞问题，保护已有历史修复。

验收条件：

- 每个修复在修改前引用相关 `REGRESSION_LOG.md` 记录。
- 能补自动回归检查的行为已补检查；不能自动化的行为已加入手工清单。
- 滑轨滚轮隔离、目录完整性、一句话概览命名和缓存隔离没有回归。
- P0 手工清单全部通过。

验证命令：

```powershell
npm run check:regression-log
npm run check
git diff --check
```

### P0.3 验证可发布构建

目标：确认源码状态和可加载的 `dist/` 产物一致。

验收条件：

- 在确认可以重建忽略目录 `dist/` 后运行当前工作区构建。
- `npm run build` 通过。
- 从 `dist/` 加载扩展后，P0 冒烟用例通过。
- Manifest 权限、版本号和 README 发布说明与目标发布状态一致。

验证命令：

```powershell
npm run build
git status --short --branch
```

## P1：补齐产品闭环并降低维护风险

### P1.1 处理当前半连接能力

范围：

- 决定并实现或移除 `panelOpen`、`autoRefresh`、`showTimeline`、`showPromptDock`、`exportFormat` 和 `panelPosition` 等设置。
- 决定并实现或移除 Popup 中尚未打通的 JSON 导出选项。
- 为文件夹提供已保存会话的查看和打开闭环，或明确缩减其产品范围。
- 将提示词库接入页面使用流程，或明确为非核心独立工具。

验收条件：

- UI 中不存在保存后无实际效果的设置。
- README、Manifest 描述和实际行为一致。
- 每个保留能力都有真实 Chrome 验收步骤。

验证命令：

```powershell
npm run check
npm run build
git diff --check
```

### P1.2 建立浏览器级自动测试

范围：

- 为消息识别、目录完整性、滑轨滚轮隔离、缓存恢复和一句话概览建立可重复浏览器测试。
- 使用固定 DOM fixture 或受控测试页，避免测试完全依赖实时 ChatGPT 页面。

验收条件：

- 核心历史回归不再只依赖源码字符串检查。
- 新测试可以验证用户可观察行为，而不仅是函数或文本存在。
- 测试命令接入 `npm run check` 或单独的明确 CI 命令。

验证命令：

```text
运行未来新增的浏览器测试命令
npm run check
```

### P1.3 拆分内容脚本

范围：

- 在行为基线和浏览器测试建立后，按 DOM 适配、问题索引、定位、UI、导出拆分 `content.js`。

验收条件：

- 拆分前后 P0 与 P1 浏览器测试结果一致。
- 模块边界明确，不通过复制代码制造新分支。
- Manifest 加载顺序和全局接口有文档记录。

验证命令：

```powershell
npm run check
npm run build
```

## P2：扩展能力

候选范围：

- 跨会话搜索、收藏、标签和批注。
- 可选的真实语义总结和主题聚类。
- 数据导入、导出和浏览器同步。
- Obsidian、Notion 或知识库集成。
- 多站点适配。
- PDF、PNG 和公式复制的高级兼容能力。

验收条件：

- 每个扩展能力有独立产品目标、隐私边界和退出策略。
- 不降低 P0 导航可靠性和页面性能。
- 新权限、网络请求或外部服务经过单独评审。

验证命令：

```powershell
npm run check
npm run build
git diff --check
```

## 推荐 Goal 顺序

1. **Goal 1：验证并稳定当前 Voyager 导航基线。**
2. Goal 2：处理 P0 验收中发现的阻塞问题。
3. Goal 3：验证 `dist/` 发布产物并对齐版本信息。
4. Goal 4：处理设置、文件夹和提示词库的半连接能力。
5. Goal 5：建立浏览器级自动测试后拆分 `content.js`。
