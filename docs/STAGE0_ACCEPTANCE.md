# Voyager Stage 0 Acceptance

## 权威记录

阶段 0 的人工结果统一记录在 `docs/STAGE0_ACCEPTANCE.json`。`docs/MANUAL_TEST_CHECKLIST.md` 说明如何测试，本文件说明如何形成可发布证据；未写入 JSON 的口头结论不计为通过。

当前记录已经预填：

- 候选构建版本、目标版本、基础提交、`dist/` 加载来源和本机 Chrome 版本。
- 本地 Chrome basic、virtualized、restore 夹具与完整检查、构建结果。
- M-01 至 M-12 的真实 ChatGPT 验收槽位，初始状态均为 `NOT RUN`。
- 20 个固定公式的 LaTeX 输入、当前 Word UnicodeMath/WPS LaTeX 自动转换结果，以及真实 Word/WPS 状态槽位；初始状态均为 `NOT RUN`。

状态只能使用 `PASS`、`FAIL`、`BLOCKED` 或 `NOT RUN`。任何 `PASS` 或 `FAIL` 都必须填写证据；公式 `FAIL` 应在证据中说明实际粘贴结果和兼容限制。

## 检查命令

校验记录结构、版本一致性、20 个公式语料和当前转换输出：

```powershell
npm run check:stage0-acceptance
```

检查是否真正满足阶段 0 人工门槛：

```powershell
npm run check:stage0-acceptance -- --require-complete
```

在人工结果未齐时，第二条命令必须失败，不能为了让命令变绿而把未执行项目改成 `PASS`。

## 真实 ChatGPT 验收

1. 从当前工作区运行 `npm run build`。
2. 在 Chrome 扩展页加载或重新加载 `dist/`。
3. 按 `docs/MANUAL_TEST_CHECKLIST.md` 的 M-01 至 M-12 执行。
4. 将每项结果、对话规模、URL/可识别说明、截图或错误写入 `docs/STAGE0_ACCEPTANCE.json`。
5. M-01 至 M-12 必须全部 `PASS` 才能进入公式与发布候选验收。

## 20 公式 Word/WPS 基线

生成可直接粘贴到 ChatGPT 的固定公式提示：

```powershell
npm run check:stage0-acceptance -- --print-formula-prompt
```

ChatGPT 渲染后，对 F-01 至 F-20 逐项执行：

1. 使用 Voyager 的“Word UnicodeMath”复制，在 Word 中按 `Alt+=` 创建公式区域后粘贴，必要时按空格或切换为 Professional；记录是否保持原数学语义。
2. 使用 Voyager 的“WPS LaTeX”复制，在 WPS 公式的 LaTeX 输入模式粘贴并确认转换；记录是否保持原数学语义。
3. `PASS` 表示目标应用中的结构和语义正确；原始文本看似合理但目标应用未转换，仍为 `FAIL`。
4. 矩阵、分段函数或其他未支持结构允许记录 `FAIL`，但必须写明兼容限制，不能记作未测试。

阶段 0 发布门槛要求 20 个公式在 Word 和 WPS 都有实际结果：成功记为 `PASS`，已确认的兼容限制记为带证据的 `FAIL`。自动转换结果只能防止输出意外变化，不能替代真实应用粘贴。
