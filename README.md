# Ocean Above · 自然语言订票应用

面向航空公司 **Ocean Above** 的 Web 订票应用：用自然语言查航线、比价、确认后出票，并可回看全部机票与历史对话。
所有城市、坐标与航线均来自 `locations.db`（唯一数据源，只读）。

> 当前进度：**前端页面 + 域引擎 + SQLite 持久化与出票守卫 + DeepSeek 工具调用循环（含流式输出）已完成**。
> 需求梳理与实施计划见 [docs/PLAN.zh-CN.md](docs/PLAN.zh-CN.md)。

---

## 快速开始

```bash
npm install
cp .env.example .env.local   # 填入 LLM_API_KEY（DeepSeek / 任意 OpenAI 兼容服务）
npm run dev                  # http://localhost:3000
npm test                     # 域引擎 + 出票守卫 + Agent（数字/话术守卫）共 43 例
npm run oracle               # 重新生成 golden fixtures
npm run verify:data          # oracle + 单测，数据变更后跑这个
```

- 需要 Node.js 20+（开发使用 Node 22）；`npm run oracle` 需要 Python 3。
- 演示账号：**用户名 `demo` · 密码 `oceanabove`**（首次启动自动播种示例数据）。
- 也可以直接在登录页注册新账号，新账号的机票与会话是空的，便于验证数据隔离。
- 应用数据落在 `data/app.db`（自动创建，已 gitignore）；删除该文件即可回到干净种子状态。
- 会话 Cookie 用 HMAC 签名；生产部署请设置 `SESSION_SECRET`（未设置时自动生成到 `data/.session-secret`）。
- 对话由 DeepSeek 驱动，配置见 `.env.example`：`LLM_BASE_URL`、`LLM_MODEL`、`LLM_API_KEY`，
  以及可选的 `LLM_TIMEOUT_MS`（默认 20000）。**未配置 key 时自动降级为确定性回复**，页面与报价照常可用。

### 其他命令

```bash
npm run build     # 生产构建
npm start         # 生产模式运行（端口 3000）
npm run typecheck # TypeScript 类型检查
```

## 页面

| 路由 | 说明 |
|---|---|
| `/` | **首页**：左侧航线网络图（711 城市 / 40 枢纽 / 151 条枢纽航线，点击枢纽高亮其直飞城市），右侧自然语言订票入口；下方为最近机票 |
| `/login` | 登录 / 注册（含演示账号提示、语言切换） |
| `/chat` | 订票台：会话列表 + 对话流 + 报价单 + 输入框 |
| `/tickets` | 我的机票：登机牌样式的客票、总额与总里程 |
| `/conversations` | 全部历史会话（归档页，从对话页侧栏进入）；`/conversations/[id]` 只读回看 |

导航只有 **首页 / 对话 / 我的机票** 三项 —— 会话列表已内嵌在对话页侧栏，不再单独占一个页签。

首页输入框提交后会在服务端创建会话，并跳转到 `/chat?c=<会话 id>` 打开该对话 —— 聊天只有一套实现，不会出现两套界面。

> 地图说明：`locations.db` 的坐标是**抽象平面坐标**（x∈[-9975, 9997]，y∈[-4992, 5000]），
> 与真实经纬度无关（例如库内 London→Paris 为 8,550 km，真实仅 336 km）。
> 因此首页画的是**按库内坐标如实绘制的网络图**，而不是贴了大陆板块的世界地图 —— 否则点位与距离会自相矛盾。

报价单以**登机牌**形式呈现：FROM / TO 区块、虚线撕口、航段表（每段距离 + 中转城市）、中转与总距离、右下角沙色总价与条码；状态区分「待确认 / 已出票 / 已过期」。只有点击「确认出票」才会生成客票，而且这一步在服务端是**两道门**：先用渲染时的报价快照哈希换取一次性 nonce，再用该 nonce 出票（任一环节缺失或重放都会被拒绝）。

界面语言为**暖色订票台**：暖褐近黑的底色（不是冷蓝）、铜色航线、米金金额、奶油色票根；地图上所有连线都是**弧线**（飞行轨迹），点枢纽会亮起流动的虚线弧；鼠标悬浮最近机票时地图会画出该航线，点击可钉住。首页右侧同时提供**传统「出发地 / 目的地」下拉选择**与自然语言输入，发送后不跳转页面，右侧整体让给会话。设计规范见 [.github/skills/ui-taste/](.github/skills/ui-taste/SKILL.md)。

## 目录结构

```
app/
  layout.tsx                 根布局（读语言 Cookie、注入 i18n Provider）
  login/                     登录页
  (app)/                     需登录的页面外壳（AppShell + 导航）
    page.tsx                 首页：航线网络图 + 自然语言入口
    chat/  tickets/  conversations/
  api/                       登录、会话、对话、报价确认、机票、网络接口
components/                  图标、导航、消息气泡、报价卡、行程时间轴、机票卡、网络图
lib/
  types.ts                   领域类型
  format.ts                  USD / km 统一格式化（en-US，逐段可复核）
  i18n/                      中英文案与语言上下文
  api/client.ts              前端调用的类型化 API 客户端
  db/locations.ts            只读读取 locations.db 并校验数据完整性
  db/{schema,app}.ts         应用库 DDL 与连接单例（better-sqlite3）
  domain/                    路线 / 计价 / 消歧 / 校验（唯一计算源）
  store/                     持久化仓储 + 报价快照哈希 + 一次性 nonce 出票链
  auth/                      scrypt 口令、HMAC 会话 Cookie、登录限流
  agent/reply.ts             确定性回复编排（只调用域引擎，不产生数字）
docs/PLAN.zh-CN.md           需求梳理与实现计划（归档）
locations.db                 唯一数据源（只读）
```

## Agent（lib/agent）—— 模型不碰算术

`POST /api/chat` 跑一个**有上限的工具循环**（最多 5 步）：模型只负责理解意图和挑选工具，数字一律由工具返回。

| 文件 | 职责 |
|---|---|
| `llm.ts` | OpenAI 兼容客户端（DeepSeek），SSE 流式解析，工具调用按 index 拼接参数碎片 |
| `tools.ts` | 4 个工具：`resolve_city` / `find_route` / `create_booking_quote` / `list_my_tickets`。返回值里带**已格式化的展示字符串**，模型只需照抄 |
| `loop.ts` | 系统提示词 + 循环 + 降级；工具结果回灌给模型 |
| `guard.ts` | 两道守卫：数字白名单、出票话术 |
| `reply.ts` | 确定性兜底（无 key / 超时 / 守卫拒绝时使用），同样只用引擎数字 |

**两道守卫**（`npm test` 里逐条锁住）：

1. **数字守卫**：把模型最终文本里的每个数字 token 拿去比对「工具结果中出现的数字集合」；出现引擎没给过的数字（如自己估算的 `3,930 km`、被注入的 `$0`）就判定不合格。
2. **话术守卫**：模型永远不能出票，因此**不允许出现"已出票 / booked / issued"这类肯定式声明**（否定语气如 "not booked yet" 放行）。

任一守卫不通过 → 丢弃模型的措辞，改用引擎生成的确定性摘要（价格仍是 `$510.35` 这种引擎值），并在工具轨迹里留一条 `number_guard` / `claim_guard` 记录。所以**模型跑偏最多让文案变生硬，不会让数字或事实跑偏**。

流式输出：`stream: true` 时接口返回 SSE（`user` / `step` / `delta` / `done` / `error`），前端边收边渲染文字与工具轨迹；`done` 里的最终消息会**覆盖**草稿，因此守卫兜底后的文案也会正确替换。非流式 JSON 仍保留，流打不开时客户端自动回退。

## 计算口径

- 距离为 `locations.db` 中两城坐标的欧氏距离（km）。
- 段距保留 2 位小数，**总距离 = 各段之和**，**价格 = 总距离 × 0.13 USD**（保留 2 位小数）。
  因此用户可以把每段数字加起来复核总价，不会出现展示漂移。

## 路线引擎（lib/domain）

唯一计算源，纯函数、无 IO：

| 文件 | 职责 |
|---|---|
| `pricing.ts` | 舍入契约：`round2`、`distanceKm`、`priceFor` |
| `graph.ts` | 枢纽子图 + Floyd–Warshall 全对最短路；确定性路径还原（字典序最小） |
| `route.ts` | 最便宜路线：枚举 `hubs(原点) × hubs(终点)`，比较用未舍入距离；平局按 距离 → 段数 → 城市序列 |
| `resolve.ts` | 城市消歧（折叠大小写与变音符号）、最近可服务城市、自由文本中的城市识别 |
| `verify.ts` | `verifyRoute()` 断言：每段是真实直飞、中间站必须是枢纽、总距离=段距和、价格=公式值 |

**为什么不能用全图最短路**：那样会让乘客在非枢纽城市换乘。抽样 300 对城市，
全图最短路有 104 对（约 35%）给出违规且更便宜的票价。

`scripts/oracle.py` 是独立的 Python 参考实现（Bellman–Ford + 显式路径枚举，算法与 TS 版不同），
生成 `lib/domain/__fixtures__/golden.json`：**1068 条路线（含全部 780 个枢纽对）** + 10 个无服务城市的最近替代。
`npm run verify:data` 让两套实现逐条比对。

## 出票守卫（为何对话里说「是」不会出票）

| 步骤 | 接口 | 作用 |
|---|---|---|
| 1. 报价 | `POST /api/chat` | 生成报价并落库为**不可变快照**，返回 `snapshotHash` |
| 2. 同意 | `POST /api/quotes/:id/consent` | 客户端回传它渲染过的 `snapshotHash`；一致才发一次性 nonce（TTL 2 分钟） |
| 3. 出票 | `POST /api/quotes/:id/confirm` | 校验 nonce 属于本人 + 未使用 + 未过期 + 快照未变，然后写 `tickets` |

没有第 2、3 步就没有任何路径能写入 `tickets`：重放 nonce 返回 `nonce_used`，报价过期返回 `expired`，
换用户访问返回 `not_found`，快照被改返回 `snapshot_changed`。`lib/store/store.test.ts` 逐条锁住这些行为。
所有请求的用户身份都来自**服务端会话表**，客户端传来的 user id 一律忽略。

## 安全与配置

- `.env.local` 已被 `.gitignore` 忽略，**不会**进入版本库；仓库里只提交 `.env.example` 占位符。
- 口令用 **scrypt + 每用户随机盐**（`scrypt$N$r$p$salt$hash`），校验用 `timingSafeEqual`。
- 会话 Cookie 形如 `<sessionId>.<hmac>`，签名密钥来自 `SESSION_SECRET`（或自动生成到 `data/.session-secret`）；
  服务端只认 `sessions` 表里存在且未过期的行，登出即删行。
- 登录 / 注册有固定窗口限流（登录 8 次/分钟，注册 5 次/10 分钟）。

## 已知限制（本阶段）

- 对话历史只取最近 8 条作为上下文（没有摘要压缩），超长会话早期信息会丢失。
- 未实现：会话搜索、分页、`GET /api/tickets/:id`、`GET /api/quotes/:id`、真实支付与库存。
