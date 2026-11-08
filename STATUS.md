# 项目状态交接

> 给下一个接手的人（或下一个会话的 AI）看。写于 2026-11-08。

## 一、当前状态

| 项 | 值 |
|---|---|
| 源码 | `D:\AI\agent\2026-11-07-23-53-35\dsh-prompt-weaver` |
| 本地安装方式 | junction：`~/.dsh/profiles/desktop/node_modules/dsh-prompt-weaver` 直连源码 |
| 已发布版本 | `v0.2.16`（远端最新 tag） |
| 未发布提交 | 无 |
| 测试 | 90 项全过 |
| 静态检查 | `node scripts/check.mjs` 与 `scripts/lint.mjs` 通过 |

**质量检测的定位（0.2.16 起）**：违规只记录、不否决。引擎任何模式下都交付模型给的文本，客户端任何模式下都写回，偏离只在 toast 与面板里提示。唯一仍会拒绝的是 `strict` 模式下的「模型擅自补前提」——那不是阈值误判，是模型编了事实。

**本地生效方式**：改完源码 → **完整重启 DSH**（刷新页面不够，宿主侧代码不会重载）。

## 二、发布节奏（用户定的）

```
攒够 5 处改动   → 发一个小版本（0.2.x +1）
攒够 15 处改动  → 发一个大版本（0.3.0 起）
单点修复不单独发版
```

`0.2.11` ~ `0.2.13` 是例外：那几版在排查一个阻塞性故障（插件完全不可用），快速迭代是为了恢复可用。

## 三、已修复的关键问题

按发现顺序，全部有代码或实测依据：

| 问题 | 位置 | 说明 |
|---|---|---|
| 面板全透 | `client.js` | 3 个主题变量在 DSH 里不存在（`--dsw-alias-bg-primary` 等），`background` 整条失效 |
| 正常结束被当失败 | `provider.js` | `reason.kind` 真实值是 `stop`，代码判 `completed` |
| 短草稿必死 | `quality.js` | 长度上限只有原文 6 倍，7 个字 → 42 字符 |
| 假设一票否决 | `engine.js` | schema 允许 `assumptions`，引擎见到非空就抛错 |
| 输出解析过严 | `structured.js` | JSON 前后有文字 / 多一个字段 / 超 10 个问题，全判死 |
| 并发 session 串扰 | `request-scope.js` | `service.currentAgent` 是共享可变字段，改为 `AsyncLocalStorage` |
| 质量失败静默写回 | `client.js` | 有 violation 时不再覆盖草稿，改为打开面板 |
| `purpose` 越界 | `provider.js` | DSH 只认 `compaction`/`session-title`，已不传 |
| `taskType` 无校验 | `engine.js` | 非法值静默退化为 general，改为报错 |
| `redactSecrets` 未生效 | `context.js` | 配置存在但实现无条件脱敏 |
| 大文件先读后查 | `context.js` | 有 `fs.stat` 时读取前跳过 |
| 噪声输入被凭空改写 | `engine.js` | `。`/`🤔`/`算了` 现在报 `too-vague` |
| 写代码被判成写作 | `analyze.js` | `writing` 关键词含裸「写」，`docs` 含「注释」 |
| `.bak` 进发布包 | `check.mjs` | 36 个备份文件已清，检查脚本发现即失败 |
| 会话切换串写 | `client.js` | 记录发起时的 sessionId，不一致就丢弃 |
| 结果跨会话丢失 | `service.js` | 按会话暂存（8 条 / 10 分钟），切回可取 |
| 端点签名不匹配 | `service.js` | `takePending(agent, request)` 声明与实现不一致，曾导致整个插件不可用 |
| `sessionIdRef` 未定义 | `client.js` | 定义在 Panel、用在 Button，每次运行都抛错 |
| 结果无法单独取用 | `client.js` | 只能手动全选再粘，已加复制按钮（0.2.14） |
| 补充的前提不可见 | `client.js` | 面板只报个数，改为逐条列出（0.2.14） |
| 对比视图只能比头尾 | `client.js` | 中间改动一律看不见，改为 LCS 对齐、超长退化（0.2.14） |
| 面板写回绕过门禁 | `client.js` | 面板路径不看 `violations` 直接落草稿，已统一 `canApplyResult`（0.2.15） |
| `.ps1` 不被当文本 | `context.js` | 扩展名漏了点号，PowerShell 脚本永远进不了上下文（0.2.15） |
| Windows 路径不加分 | `context.js` | 反斜杠路径匹配不上 `/src/`，评分前先归一化（0.2.15） |
| 分析卡标签错位 | `client.js` | 「受保护项」显示的是约束数，改为约束数 + 待确认逐条（0.2.15） |
| 显式 locale 被忽略 | `engine.js` | 语言分支先于 `requested` 返回，改为请求优先（0.2.15） |
| 违规拦掉整次增强 | `engine.js` / `client.js` | `strict` 下直接抛错、其他模式下不写回；改为「只提示、必交付」（0.2.16） |

## 四、已知未修（按优先级）

### P0 · 需要真实环境验证

| 项 | 说明 |
|---|---|
| **并发双会话** | 单元测试只证明作用域隔离，没有真实双会话实测 |
| **取消** | 代码已接 AbortSignal，未实测 |
| **跨会话取回** | 代码已完成，未实测 |
| **0.2.15 / 0.2.16 的界面改动** | 违规不再拦写回、分析卡、待确认列表均未在真实 DSH 里看过 |

### P1 · 未实现

| 项 | 位置 | 说明 |
|---|---|---|
| context 总预算 | `context.js` | `maxTotalBytes` 只裁 files，tree + conversation 可超总预算 |
| provider 完成事件 | `provider.js` | 流异常结束但已有文本时，仍可能被当成完整结果 |
| abort 识别 | `provider.js` | 只认 `AbortError`/`ABORT_ERR`，其他形态会报成 model-failed |
| locale 双源 | `client.js` / `locale/*.json` | 内联字典与 JSON 文件两套，新增 key 未同步 |
| CLI 预算 | `bin/` | 未复用 `context.js` 的预算与脱敏，且同文件脱敏跑了两遍 |
| `timeoutMs` 语义 | `provider.js` | 只覆盖模型调用，不覆盖 context 扫描（文档需同步） |
| Windows CI | `.github/workflows/ci.yml` | 只有 ubuntu |

### P2 · 质量层

| 项 | 说明 |
|---|---|
| **49 条语料未接 CI** | 语料在 `tests/fixtures/testset.jsonl`，只入库没写断言 |
| **输出质量无度量** | 意图保真、增益适度全靠人工判断 |
| **具体化能力不足** | 对"打开抖音并点赞"，仍不如 WorkBuddy 那份会替用户补实现路径 |

## 五、待攒的改动（目标 5 处发下一版）

`0.2.14` 消耗 4 处：`sessionIdRef` 修复、复制按钮、`assumptions` 展示、LCS diff。

`0.2.15` 消耗 8 处：写回门禁统一、`.ps1` 扩展名、Windows 路径归一化、分析卡标签错位、待确认逐条展示、`renderQuality` 恒真条件、显式 locale 优先、导入限额改字节。

`0.2.16` 消耗 1 处（但属行为变更）：违规不再否决增强结果，改为「必交付 + 提示偏离数」。

剩余候选，攒满 5 处发下一版：

1. locale 单源化（内联字典与 `locale/*.json` 两套）
2. CLI 预算对齐 host 侧 `context.js`（含同文件重复脱敏）
3. context 总预算（tree + conversation 也受 `maxTotalBytes` 约束）
4. provider 完成事件与 abort 形态识别
5. 49 条语料的可自动判定断言
6. Windows CI

清单外的改动照常可以进版，只是不占这 5 个名额。

## 六、怎么验证（当前可用）

```powershell
cd D:\AI\agent\2026-11-07-23-53-35\dsh-prompt-weaver
node --test "tests/*.test.js"      # 期望 pass 90 / fail 0
node scripts/check.mjs             # 期望 check ok: 44 JS / 11 JSON
node scripts/lint.mjs              # 期望 lint ok: 77 file(s)
```

界面层（重启后）：

| 输入 | 期望 |
|---|---|
| `。` | 报 `[too-vague]`，输入框不变 |
| `打开抖音并点赞` | 五节结构（目标/实现方式/步骤/成功判定/异常处理），结果写回 |
| `这个模型是谁提供的` | 一个更精确的问句，无【待确认】清单 |
| `帮我写个 C++ 控制舵机的程序` | code 框架，写回输入框 |
| 带 `/prompt`、`@file`、URL 的草稿 | 增强结果写回，toast 末尾可能带 `N 处偏离`，但**不会**因为偏离而不写回 |
| 面板里点增强、结果带偏离 | 仍然写回并自动关面板，面板质量卡显示偏离项 |

## 七、关键约定

1. **改宿主侧代码必须完整重启 DSH**，刷新页面不生效
2. **改了 `client.js` 也要重启**（client bundle 在启动时注入）
3. **拿不准插件是否加载**：调 `POST /api/prompt-weaver/xxx` 看返回 401 还是 404
4. **`svc.currentAgent` 已废弃**，用 `currentScope()`
5. **`cordis.patch.yml` 里覆盖插件配置，`- id:` 用插件自带 patch 声明的 id**（`prompt-weaver`，不是包名）
6. **失败时先看 toast 前缀**：`[reason]` = 业务失败，`rpc failed` = 传输失败，`write-back failed` = 写回失败，`enhance failed` = 其他

## 八、下一步建议

按价值排序：

1. **重启验证 `0.2.14` 的三个新增界面**：复制按钮是否真能写入剪贴板、假设是否逐条出现且不与结果重复、差异视图的中段改动是否可见
2. **补 locale 单源化与 CLI 预算**，攒满 5 处发 `0.2.15`
3. **把 49 条语料的可自动判定部分写成测试** —— 这是从"有测试"到"有度量"的关键一步，也是 0.3.0 的合理门槛
4. 之后再谈"具体化能力"这类需要换思路的事
