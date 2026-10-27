# Ocean Above

一个自然语言订票应用：用一句话查航线、比价，确认之后才出票。城市、坐标、航线全部来自 `locations.db`，它是唯一数据源，只读。

技术栈：Next.js 15（App Router）+ TypeScript + Tailwind 3，业务状态存 SQLite，对话由 OpenAI 兼容的 LLM（默认 DeepSeek）驱动。

设计与决策见 [docs/PLAN.zh-CN.md](docs/PLAN.zh-CN.md)。

## 跑起来

```bash
npm install
cp .env.example .env.local    # 填入 LLM_API_KEY
npm run dev                   # http://localhost:3000
```

```bash
npm test          # 63 例：域引擎 + 出票守卫 + Agent 守卫
npm run typecheck
npm run build
npm run oracle    # 重新生成 golden fixtures（需要 Python 3）
npm run verify:data   # oracle + 单测，数据变更后跑这个
```

Node.js 20+。

演示账号：用户名 `demo`，密码 `oceanabove`。首次启动会自动播种演示数据，登录页底部同一行标出。
也可以注册新账号（用户名 + 密码 + 姓名，用户名与密码均为 8–16 位字母或数字且不可重复），新账号的机票与会话是空的，方便验证数据隔离。登录不校验格式，所以早先创建的短用户名照常能登。

业务数据落在 `data/app.db`（自动创建，已 gitignore）。删掉这个文件就回到干净的种子状态。会话 Cookie 用 HMAC 签名，密钥取 `SESSION_SECRET`，未设置时自动生成到 `data/.session-secret`。

没有配 `LLM_API_KEY` 也能用：对话自动降级为确定性回复，报价、出票、页面全部照常。LLM 相关配置只有三项：`LLM_BASE_URL`、`LLM_MODEL`、`LLM_API_KEY`，另有可选的 `LLM_TIMEOUT_MS`（默认 20000）。

## 页面

| 路由 | 内容 |
|---|---|
| `/` | 首页。左边航线网络图，右边订票台 |
| `/login` | 登录 / 注册 |
| `/chat` | 订票台：会话列表（可搜索、可翻页）+ 对话流 + 报价单 |
| `/tickets` | 我的机票，登机牌样式，可折叠 |
| `/conversations` | 历史会话归档；`/conversations/[id]` 只读回看 |

导航只有首页 / 对话 / 我的机票三项，会话列表内嵌在对话页侧栏。首页输入框发出的消息在右侧面板就地展开成会话（服务端建会话，页面不跳转），要换纯对话视图再去 `/chat`。

首页左列上半是网络图，下半是最近机票（航线 / 预订时间 / 起飞时间 / 距离 / 合计，最多 8 行，窄屏依次收起预订时间和距离）。右列订票台同时提供结构化的出发地、目的地、出发时间、多程、乘客名单，和下面的自然语言输入框。

几个刻意的选择：

- **城市和时间的选择器是自绘的。** 原生 `<select>` 与 `datetime-local` 的展开层由浏览器绘制，亮蓝高亮和系统字体跟整页暖色对不上，而且给闭合态加样式修不了展开态。弹层 Portal 到 `document.body`，跟随滚动与缩放实时重算。
- **地图按数据比例定高，图填满自己的面板**，不留黑边；两列撑到页面底部，不靠 JS 监听，是 CSS `aspect-ratio`。
- **多程是一条链**：第二程起只选目的地，页面上标出「第 2 程 · 从 Split 出发」。上一程没选目的地时「添加一程」置灰并给出原因。「重新查询」清空出发地、目的地、所有续程、乘客和时间。
- **地图同一时刻只讲一件事**：悬浮机票行或会话出了报价时，之前点过的城市自动让位；再点城市则由城市接管。两种高亮不叠在一起。选中城市有星状扩散，航线有沿弧线的方向性流光，`prefers-reduced-motion` 下静止。
- **客票默认全部收起，一次只展开一张**，收起时条码不进 DOM，扫码不会误读到别的票。
- **乘客留空即账号本人**，占位符显示当前登录用户的姓名。

报价单做成登机牌：FROM/TO 区块、虚线撕口、航段表（每段距离与中转城市）、总距离、右下角金色总价、条码。状态只有「待确认 / 已出票 / 已过期」三种。

界面上不解释数据模型 —— 没有构建徽标、数据库名、定价公式、建模假设。这些写在本文档里。设计规范见 [.github/skills/ui-taste/SKILL.md](.github/skills/ui-taste/SKILL.md)。

## 数据与口径

`locations.db` 实测：711 个城市、40 个枢纽、151 行 `hub_links`、661 个可服务的非枢纽城市、10 个无服务城市。枢纽子图全连通，任意两个可服务城市之间必有路线。

`hub_links` 每对枢纽只存一行，必须按无向边处理。`connected_hubs` 无脏数据。

坐标是抽象平面（x∈[-9975, 9997]，y∈[-4992, 5000]），不是真实经纬度 —— 库内 London→Paris 是 8,550 km，真实只有 336 km。所以首页画的是按库内坐标如实绘制的网络图，而不是贴了大陆板块的世界地图，否则点位和距离自相矛盾。

计算口径：

- 距离是两城坐标的欧氏距离，**每段保留 2 位小数**；
- 总距离 = 各段（已舍入）之和；
- 票价 = `round(总距离 × 0.13, 2)`，**只舍入一次**，不是把每段票价相加（那样会差几分钱）；
- 订单合计 = 票价 × 人数（二次舍入）。

这样「各段相加 = 总距离、总距离 × 0.13 = 票价」在屏幕上逐项可复核，不会出现 +0.01 的展示漂移。

路线必须是 `起点 → 枢纽 → … → 枢纽 → 终点`，中间只能在枢纽换乘。在全图上直接跑最短路会把非枢纽当成换乘点，抽样 300 对城市里有 104 对（约 35%）算出违规且更便宜的票价。所以实现是枢纽子图 APSP + 端点枚举，平局按 距离 → 段数 → 城市序列，同一问题永远同一答案。

出发时间不参与计价，也不按班期校验 —— 我们假设所有航班在任何时间都可选。它会进报价快照（改时间等于改快照 hash）并印在票面。对话里没说时间就取明天 09:00。

一张行程最多 4 个城市对、6 位乘客。

## 代码结构

```
app/                     页面与路由处理器
  login/  (app)/         登录页；需登录的页面外壳（首页 / chat / tickets / conversations）
  api/                   auth、chat、conversations、network、quotes、tickets
components/              订票台、地图、报价卡、客票卡、选择器等
lib/
  types.ts  format.ts    领域类型；唯一的数字格式化处
  i18n/                  zh / en 字典与语言上下文
  api/client.ts          前端唯一的 fetch 出口
  db/                    locations.db 只读加载与自检；app.db 连接与 DDL
  domain/                纯函数引擎：graph / route / itinerary / pricing / resolve / network / verify
  store/                 持久化仓储、快照 hash、一次性 nonce 出票链
  auth/                  scrypt 口令、HMAC 会话 Cookie、限流
  agent/                 llm / tools / loop / guard / reply
  hooks/                 弹层定位、关闭、会话搜索
scripts/oracle.py        独立的 Python 参考实现
docs/PLAN.zh-CN.md       设计文档
locations.db             唯一数据源（只读）
```

`lib/domain/**` 是唯一计算源，纯函数、无 IO。`scripts/oracle.py` 用不同算法（Bellman–Ford + 显式路径枚举）独立算一遍，生成 `lib/domain/__fixtures__/golden.json`（1068 条路线，含全部 780 个枢纽对，加 10 个无服务城市的最近替代），`npm run verify:data` 让两套实现逐条比对。

## Agent

`POST /api/chat` 跑一个最多 5 步的工具循环。模型只负责理解意图和挑工具，数字一律由工具返回。

| 工具 | 作用 |
|---|---|
| `resolve_city` | found / ambiguous / no_service / not_found，歧义返回候选 |
| `nearest_served_city` | 无服务城市最近的可用城市及距离 |
| `find_itinerary` | 结构化行程（内部跑 `verifyItinerary`，不把不变量交给模型） |
| `direct_destinations` | 某城市能直飞哪些城市 |
| `create_booking_quote` | 重算路线再落库为不可变快照，返回 `quote_id` 与逐字展示文本 |
| `list_my_tickets` | 按登录用户过滤 |

没有出票工具。工具返回值里带已格式化的展示字符串，模型只需照抄。

两道守卫，`npm test` 里逐条锁住：

1. **数字守卫**：模型最终文本里的每个数字 token 都要出现在「工具结果 + 用户原话 + 0.13」这个集合里，否则判不合格。自己估算的 `3,930 km`、被注入的 `$0` 都会被拦下。
2. **话术守卫**：模型没有出票能力，所以不允许出现「已出票 / booked / issued」这类肯定声明（否定语气放行）。

任一守卫不过 → 丢弃模型的措辞，改用引擎生成的确定性摘要，价格仍是引擎值，并在轨迹里留 `number_guard` / `claim_guard`。模型跑偏最多让文案变生硬，不会让数字或事实跑偏。

回复语言由界面决定：`systemPromptFor(lang)` 把「用简体中文作答 / answer in English」写进系统提示，城市名始终保留数据库原文。

流式输出：`stream: true` 返回 SSE（`user` / `step` / `delta` / `done` / `error`），`done` 里的最终消息覆盖草稿，所以守卫兜底后的文案也能正确替换。流打不开时客户端自动回退到非流式 JSON。

工具轨迹只入库（`messages.tools_json`）不上屏 —— 用户只看到自然语言答案和报价卡片。

两种城市情况都不会编造数据：库里有这个城市但没通航（如 Abu Dhabi），告知无服务并给出按坐标量出的最近可用城市；库里根本没有这个城市（如 "New York City"），没有坐标就不给任何距离，只推荐最相近的已知城市。

## 出票守卫

对话里说「是」不会出票。写 `tickets` 表只有一条路径，分三步：

| 步骤 | 接口 | 作用 |
|---|---|---|
| 1. 报价 | `POST /api/chat` 或 `/api/quotes` | 落库为不可变快照，返回 `snapshotHash` |
| 2. 同意 | `POST /api/quotes/:id/consent` | 客户端回传它渲染过的 `snapshotHash`，一致才发一次性 nonce（TTL 2 分钟） |
| 3. 出票 | `POST /api/quotes/:id/confirm` | 校验 nonce 属于本人、未使用、未过期、快照未变，然后写票 |

重放 nonce 返回 `nonce_used`，报价过期返回 `expired`，换用户访问返回 `not_found`，快照被改返回 `snapshot_changed`。报价本身 15 分钟过期。快照 hash 用「键排序后的规范 JSON + sha256」，保证可复现。

结构化表单走 `POST /api/quotes`，确定性、不经模型；自然语言走 Agent。

## 双语与格式

所有界面文案在 `lib/i18n/dictionary.ts`，扁平键，`Dictionary` 类型强制中英一一对应。城市名不翻译，一律数据库原文。数字格式全部走 `lib/format.ts`（`en-US`，`8,928.56 km`、`$1,160.71`），组件里不做 `Intl` 或 `toFixed`。

## 安全

- `.env.local` 已 gitignore，仓库里只有 `.env.example` 占位符。
- 口令用 scrypt + 每用户随机盐（`scrypt$N$r$p$salt$hash`），校验走 `timingSafeEqual`。
- Cookie 形如 `<sessionId>.<hmac>`，httpOnly / SameSite=Lax；服务端只认 `sessions` 表里存在且未过期的行（7 天），登出即删行。
- 每个请求的用户身份都从服务端会话推导，客户端传来的 user id 一律忽略。
- 登录 8 次/分钟、注册 5 次/10 分钟固定窗口限流。

## 已知限制

- 上下文只取最近 8 条消息，超长会话的早期信息会丢。
- 多程按「每段城市对独立计价」处理，没有日期与班期概念，不是真正的联程；同一段内也不能改期。
- 敞口（open jaw）行程是非法输入，这是有意的边界。
- 未实现：`GET /api/tickets/:id`、`GET /api/quotes/:id`、真实支付、库存、找回密码、邮箱验证。

## 交付物

代码、本 README、[docs/PLAN.zh-CN.md](docs/PLAN.zh-CN.md)、[AGENTS.md](AGENTS.md)（不可协商的领域规则）、[prompt history/](prompt%20history/README.md)（原始会话，已去密钥）。
