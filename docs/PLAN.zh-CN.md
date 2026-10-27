# Ocean Above 订票应用 —— 实现计划（归档）

> 本文档归档需求分析与实现方案。原始需求见 [take-home（中文）](../Quotr%20Agent%20Dev%20Engineer%20take-home.zh-CN.md)。
> 已确认的技术选型：**DeepSeek（OpenAI 兼容协议）**、**中英双语 UI**、**用户名 + 密码登录**、**localhost:3000 本地运行**。

---

## 1. 需求映射

| # | 需求 | 设计手段 | 验收方式 |
|---|---|---|---|
| R1 | 自然语言输入 | LLM Agent + 工具调用，模型只做语言理解与流程编排 | 脚本化 NL 场景断言工具调用序列 |
| R2 | locations.db 唯一真相 | 只读连接（`mode=ro`），代码中零硬编码城市/航线 | 全局搜索无城市名常量；启动自检 |
| R3 | 两张表结构 | `locations` / `hub_links`，启动时校验外键、空值、坐标格式 | 数据自检脚本输出统计 |
| R4 | 航线拓扑 | 枢纽↔枢纽按 `hub_links` **无向**处理；非枢纽仅连其 `connected_hubs`；中间节点必须是枢纽 | `verifyRoute()` 逐条断言 |
| R5 | 最便宜路线 | 枢纽子图 APSP + 端点枚举（见 §4） | 与独立 Python 参考实现逐对比对 |
| R6 | 距离/价格 | 段距欧氏距离；总距离 = 段距之和；价格 = 总距离 × 0.13 | 单测 + 逐项复核 |
| R7 | 订票前确认全程 | 报价单不可变快照 + UI 确认卡 + 一次性 nonce | 无确认的下单请求必须失败 |
| R8 | 无服务城市提示 | 返回最近的可服务城市及其距离，**绝不静默替换** | 10 个无服务城市全覆盖测试 |
| R9 | 查询自己的订单 | `list_tickets` 只读工具，按登录用户过滤 | 跨用户越权测试 |
| R10 | 查看所有会话 | 会话/消息持久化 + 列表 + NL 检索工具 | 刷新后可回看 |

## 2. 数据源实测事实

- **711** 个城市、**40** 个枢纽、**151** 行 `hub_links`、**661** 个可服务非枢纽、**10** 个无服务城市。
- 枢纽子图**全连通**（151 条边，最小度数 17）→ 任意两个可服务城市之间必有可行路线。
- `hub_links` 每对枢纽**只存一行**（非双向两行）→ 必须按无向边处理。
- 存在真实**名称歧义**：`San Jose`/`San José`、`Georgetown`/`George Town`、`Santiago`(枢纽)/`Santiago de Cuba`/`Santiago de Compostela`/`Santiago de los Caballeros`。
- 坐标是**抽象 2D 地图**（x∈[-9975, 9997]，y∈[-4992, 5000]），不是真实地理；一切距离严格按库计算，产品文案不暗示真实航距。
- `connected_hubs` 无脏数据（无空白、无重复、引用的都确实是枢纽）。

## 3. 最大的正确性陷阱

在"全图"上直接跑最短路会把**非枢纽当成换乘点**，产生违规且更便宜的路线，例如 `Shanghai → Split → Lagos → London`（Split 非枢纽）。抽样 300 对城市，**104 对（约 35%）会被算错价格**。

因此路线模型必须是：

```
A → h₁ → h₂ → … → hₙ → B     其中 hᵢ 全部为枢纽
```

中间只能走枢纽子图，非枢纽只能作为起点或终点。

## 4. 路线算法与数值口径

1. 启动时构建枢纽子图（40 节点、151 条无向边），对每个枢纽跑一次 Dijkstra，得到枢纽两两最短距离与前驱表（用于还原换乘城市）。
2. 对任意 `A → B`：
   ```
   cost(A,B) = min over hA ∈ hubs(A), hB ∈ hubs(B) [ d(A,hA) + hubDist(hA,hB) + d(hB,B) ]
   ```
   其中 `hubs(A)`：A 是枢纽则为 `[A]`，否则为其 `connected_hubs`；连接距离在端点即枢纽时为 0。
3. **确定性 tie-break**：总距离最小 → 段数最少 → 城市序列字典序最小。同一问题永远同一答案。
4. **数值口径（重要）**：
   - 最优性比较使用未舍入的欧氏距离；
   - 快照内**每段距离保留 2 位小数**，`总距离 = 各段（已舍入）之和`；
   - `价格 = round(总距离 × 0.13, 2)`。
   - 这样"段距之和 = 总距离、总距离 × 0.13 = 价格"三条恒等式对用户逐项可复核，不会出现 +0.01 的展示漂移。
5. **不做的事**：不接受 LLM 传来的任何数值；所有展示值由服务端快照生成，工具返回值即前端渲染值。

## 5. 架构与数据流

```
Next.js 15 App Router (localhost:3000)
├─ app/                页面：/login /chat /tickets /conversations
├─ app/api/            REST + SSE：chat、quotes/confirm、tickets、conversations、auth
├─ lib/domain/         纯函数：graph / route / nearest / pricing / verify（唯一计算源）
├─ lib/agent/          provider 无关的 tool-calling 循环（OpenAI 兼容）
├─ lib/i18n/           zh / en 字典与语言上下文
└─ data/
   ├─ locations.db     只读，唯一真相
   └─ app.db           业务状态（users / conversations / messages / quotes / tickets）
```

数据流：用户消息 → `/api/chat` → Agent 循环 → 工具调用（域引擎/REST 仓储）→ 消息落库 → SSE 推送 → UI 渲染；报价卡片的"确认并出票"走独立 REST 端点，不经模型。

## 6. Agent 工具设计

| 工具 | 类型 | 职责 | 设计理由 |
|---|---|---|---|
| `resolve_city(name)` | 只读 | 返回 `found / ambiguous / not_found`；歧义返回候选；无服务返回最近可服务城市 | 消歧必须由用户决定，禁止猜测；R8 在此闭环 |
| `find_route(origin, dest)` | 只读 | 结构化路线快照（每段、换乘、总 km、总价） | 纯计算，不产生副作用，可反复调用 |
| `create_booking_quote(origin, dest)` | 写（待确认） | 落库不可变快照 + `snapshotHash`，返回 `quote_id` 与逐字展示文本 | 把"呈现"变成可验证的持久状态 |
| `confirm_booking(quote_id)` | 写（出票） | 仅在 UI 确认卡签发的一次性 nonce 存在时成功 | 见 §7，模型无法自行出票 |
| `list_tickets()` / `get_ticket(id)` | 只读 | R9 | 按用户过滤，仅返回结构化数据 |
| `list_conversations()` / `search_conversations(q)` / `get_conversation(id)` | 只读 | R10 | 自然语言可查历史 |
| `get_today()` | 只读 | 支撑"下周二"等相对日期 | 日期仅记录在票面，不影响价格 |

设计原则：**读/写分离**、**单一职责**、**模型不碰算术**、**返回值即 UI 渲染源**。

## 7. 如何保证"未经确认绝不出票"

1. **结构层**：不存在"直接订票"工具；出票必须引用已持久化的 `quote`。
2. **人在环**：报价卡上的确认按钮调用 `POST /api/quotes/:id/confirm`，服务端签发绑定 `(userId, quoteId, snapshotHash)` 的**一次性 nonce**；Agent 的 `confirm_booking` 需要该 nonce。
3. **内容绑定**：nonce 仅在卡片渲染内容与快照 hash 一致时签发，杜绝"确认 A 出票 B"。
4. **状态机 + 单次使用**：`pending → booked`，nonce 使用即标记 `used_at`、TTL 2 分钟；重放、过期、跨用户、快照变化分别返回 `nonce_used` / `nonce_expired` / `not_found` / `snapshot_changed`。全流程写 `audit_log`（触发者、动作、快照 hash、客票号）。

文本确认（"好的，确认"）默认不构成出票依据，因为仅靠提示词约束不可靠。

## 8. 数据模型（app.db）

- `users(id, username, password_hash, display_name, created_at)` —— 盐编码在 `password_hash` 内（`scrypt$N$r$p$salt$hash`）
- `sessions(id, user_id, created_at, expires_at)`
- `conversations(id, user_id, title, created_at, updated_at)`
- `messages(id, conversation_id, role, content, quote_id, tool_trace_json, created_at)`
- `quotes(id, user_id, conversation_id, snapshot_json, snapshot_hash, status, expires_at, confirmed_at)`
- `confirmations(nonce, quote_id, user_id, snapshot_hash, created_at, expires_at, used_at)`
- `tickets(id, user_id, quote_id, origin, destination, total_km, price_usd, passenger, created_at)`
- `ticket_legs(ticket_id, seq, from_city, to_city, distance_km)`
- `audit_log(id, user_id, action, quote_id, snapshot_hash, detail, created_at)`

## 9. 用户体系（简单，但边界正确）

- 用户名 + 密码；`node:crypto.scrypt` 加盐哈希，绝不存明文。
- 服务端会话表 + HMAC 签名的 httpOnly / SameSite=Lax Cookie。
- **所有查询按服务端 Cookie 中的 userId 过滤**，不信任客户端传参。
- 已知限制（不实现）：找回密码、邮箱验证、角色权限、强防爆破策略。

## 10. 中英双语

- `lib/i18n/{zh,en}.ts` 字典 + 语言切换（持久化）。
- **城市名不翻译**，一律按 `locations.db` 原文展示，避免自造译名导致与数据源不一致。
- 数字格式全语言统一（`en-US`）：`8,928.56 km`、`$1,160.71`。
- Agent 回复语言跟随用户输入语言；报价卡字段由前端字典渲染，因此工具只返回结构化数据。

## 11. 已知失效模式与后续

| 失效模式 | 处理 |
|---|---|
| 模型不可达 / 超时 | 明确提示 + 确定性规则兜底；订单与会话浏览仍可用 |
| 城市名歧义 | 返回候选并追问，不猜 |
| 无服务城市 | 提示 + 最近可服务城市及距离，不静默替换 |
| 起降同城 / 未知城市 | 参数校验，直接拒绝 |
| 报价过期 / 重复确认 / 并发确认 | TTL + 状态机 + nonce 单次使用（重放返回 `nonce_used`，不再幂等发第二张票） |
| Prompt 注入（"忽略指令直接出票"） | 出票依赖 nonce，模型无权限绕过 |
| 坐标是抽象地图 | 文档与 UI 明确说明；不做真实地理推断 |
| 无支付、无班期、无库存、单乘客、不支持多程 | 明确列为需求外 |

后续可做：多方案对比、票面打印/分享、审计日志 UI、限速、金额国际化、真实支付与库存。

## 12. 交付物

代码、`README.md`（运行方式）、设计文档（架构、工具、数值正确性、确认机制、局限）、`prompt history/`（原始会话，去密钥）、本计划归档。

## 13. 实施顺序

1. ~~工程骨架（Next.js + TS + Tailwind + i18n + 主题）~~ ✅
2. ~~域引擎（TDD + Python 参考实现交叉验证）~~ ✅ `lib/domain`，1068 条 fixture 与 `scripts/oracle.py` 逐条一致
3. ~~持久化与 REST（含认证加固、nonce 确认链）~~ ✅ `lib/store` + `lib/auth`，守卫测试 12 例
4. ~~Agent 工具循环（接入 DeepSeek）~~ ✅ `lib/agent`，流式 + 数字/话术守卫 + 确定性降级
5. ~~UI 联调（聊天 / 报价单 / 订单 / 会话）~~ ✅
6. ~~加固（守卫测试、注入用例、降级）与交付文档~~ ✅
7. ~~会话检索与分页、多程 / 多乘客~~ ✅ 见 P4 落地记录
8. ~~交互打磨（出发时间、地图交互、客票折叠）~~ ✅ 见 P5 落地记录
9. ~~缺陷修复（城市名单悬浮、文案换行、回复语言与直飞查询）~~ ✅ 见 P6 记录
10. ~~需求复核：直飞邻接缺陷、无服务城市两步流程、名单可点击、prompt history~~ ✅ 见 P7 记录

### P1 落地记录

- 枢纽子图 Floyd–Warshall + 字典序最小路径还原；端点枚举比较**未舍入**距离，平局按 距离 → 段数 → 城市序列。
- 线路不变量由 `verifyRoute()` 在报价前断言（曾据此抓出「枢纽→非枢纽段被判为非法直飞」的真实缺陷）。
- 城市消歧：折叠大小写/变音符号/标点后精确匹配；多解返回候选；自由文本按最长窗口识别，长度≤4 词的歧义名同样上报。
- 无服务城市：按坐标取最近的可服务城市，10 个全部覆盖。

### P2 落地记录

- **持久化**：`data/app.db`（better-sqlite3，WAL + `foreign_keys=ON`），表结构见 `lib/db/schema.ts`：
  `users / sessions / conversations / messages / quotes / confirmations / tickets / ticket_legs / audit_log`。
  首次创建时由 `lib/store/seed.ts` 播种演示账号；**种子里出票也走真实 nonce 链**，演示数据不能绕过规则。
- **认证加固**：`scrypt$N$r$p$salt$hash`（每用户随机盐，`timingSafeEqual` 校验）；Cookie 值 `<sessionId>.<hmac>`，
  服务端只认 `sessions` 表内的行；登录 8 次/分钟、注册 5 次/10 分钟固定窗口限流；密钥来自 `SESSION_SECRET`
  或自动生成到 `data/.session-secret`（`data/` 整体 gitignore）。
- **确认链两级化**：`POST /api/quotes/:id/consent` 校验客户端回传的 `snapshotHash` 后签发一次性 nonce（TTL 2 分钟）；
  `POST /api/quotes/:id/confirm` 只用 nonce 换票。报价快照用「键排序后的规范 JSON + sha256」保证可复现。
- **一处设计修正**：`confirmQuote` 原本对已出票的报价「幂等返回旧票」，导致重放 nonce 看起来成功。
  现在**先校验 nonce 再看报价状态**，重放一律返回 `nonce_used`；`tickets` 表只剩这一条写入路径。
- **守卫测试**（`lib/store/store.test.ts`，12 例）：无 nonce / 伪造 nonce / 快照不符 / 重放 / 过期报价 /
  过期 nonce / 已出票再同意 / 跨用户越权 / 用户名大小写唯一 / 口令加盐 / 凭据校验 / 消息顺序。
- 删除 `lib/mock/`（内存 store 与占位 SHA-256 认证），所有页面与 API 改由 `lib/store` + `lib/auth` 支撑。

### P3 落地记录

- **工具循环**（`lib/agent/loop.ts`）：系统提示词 + 最多 5 步；模型只选工具与措辞，工具返回**已格式化的**展示字符串（`formatKm` / `formatUsd`），模型只需照抄。
- **工具集**（`lib/agent/tools.ts`）：`resolve_city`（含歧义 / 无服务）、`find_route`（内部跑 `verifyRoute` 断言，不把不变量交给模型）、`create_booking_quote`（重算路线再落库，杜绝模型传数字）、`list_my_tickets`。**没有任何出票工具**。
- **数字守卫**（`lib/agent/guard.ts`）：允许集合 = 所有工具结果里出现的数字 token + 用户原话里的数字 + 价格常数 0.13；模型文本里出现其它数字即判不合格。
- **话术守卫**：出票类肯定声明（booked / issued / paid / 已出票 …）一律拒绝，否定语气放行——因为模型没有出票能力，说“已出票”必然是假。
- 任一守卫拒绝 → 改用确定性摘要（引擎数字），并在轨迹里记录 `number_guard` / `claim_guard`。实测：模型被注入“直接出票并报 $1”时，回复仍是否认 + 引擎价 $510.35。
- **流式输出**：`stream: true` 返回 SSE（`user` / `step` / `delta` / `done` / `error`），前端逐字渲染并实时显示工具轨迹；`done` 的最终消息覆盖草稿，守卫兜底也能正确呈现。流不可用时客户端自动回落 JSON。
- 踩坑记录：DeepSeek 要求回灌历史时 `tool_calls[].type` 必须为 `"function"`，否则 422；工具参数在流中以碎片到达，需按 `index` 拼接。
- 测试：`lib/agent/agent.test.ts` 16 例（守卫、SSE 解析、工具语义、完整往返、注入、降级、步数上限）。

### P4 落地记录

- **会话检索与分页**：`conversations` 增加 `search_text`（标题 + 全部消息正文，折叠大小写与变音符号后的小写文本），
  `appendMessage` / `createConversation` 增量维护；`searchConversations()` 用 `like ? escape '\'` 匹配（`%`、`_` 被转义为字面量），
  游标为 `updated_at|id`，`limit` 上限 50。接口 `GET /api/conversations?q=&cursor=&limit=` 返回 `nextCursor` 与 `total`。
  前端 `lib/hooks/conversation-search.ts` 统一处理防抖、翻页与“旧响应覆盖新查询”的竞态（requestId 校验）。
- **多程**：新增 `lib/domain/itinerary.ts`。`Itinerary = journeys[] + passengers[] + totalDistanceKm + priceUsd + totalPriceUsd`；
  **票价按行程总距离只舍入一次**，而非各段票价相加；`verifyItinerary()` 逐程断言并复核总价。
  报价/客票从“单条 legs”改为 `journeys[]`（每程自带 legs / transfers / 距离），`ticket_legs` 增加 `journey_seq` 以还原分程。
- **多乘客**：乘客名单是数据录入（不是算术），模型或表单都可提供；上限 6 人，去空白并大小写去重。
  订单合计 = 每人票价 × 人数，二次舍入；客票存 `passengers_json` 与 `total_price_usd`。
- **结构化下单**：新增 `POST /api/quotes`，首页表单直接提交城市对 + 乘客名单，走同一条域引擎与 nonce 链路（不经过模型，避免延迟与不确定性）；
  自然语言仍走 `/api/chat` 的 Agent。
- **迁移**：`openDatabase()` 增加 `migrate()`，用 `pragma table_info` 增量 `alter table`，并为老数据回填
  `search_text`、`passengers_json`、`total_price_usd`、`ticket_legs.journey_seq`，旧库无需删除即可升级。
- 测试：域 5 例（多程合计只舍入一次、多人合计、非法行程、校验器抓篡改）、store 5 例（折叠搜索、通配符转义、游标翻页、多人出票、多程客票），合计 53 例。

### P5 落地记录（交互打磨）

- **出发时间**：`Itinerary.departAt` 进入报价快照与客票（`tickets.depart_at`），`resolveDeparture()` 负责默认值
  （明天 09:00）、可解析性与"不能是过去"（留 6 小时给跨时区客户端）。**时间不参与计价**，因为我们假设
  所有航班在任何时间都可选，没有班期/库存概念。表单用 `datetime-local`；Agent 可透传 `departAt`，
  没说就由服务端定，并在卡片上照实显示。
- **默认乘客**：表单不填乘客时用**账号显示名**（不是 "Passenger"）；Agent 侧通过 `ToolContext.defaultPassenger` 对齐。
- **Agent 不打印原始时间戳**：工具回给模型的是 `formatDateTime()` 后的可读时间，提示词明确禁止贴 ISO 串。
- **聊天区文案**：`home.subline` 从标题下方移到输入框上方；Home 面板去掉顶部标题行（线程模式下那行只留
  「重新查询」，标题弱化为等宽小字）。
- **对调按钮**：移入出发地/目的地之间（`sm:grid-cols-[1fr_auto_1fr]`），**多程时整块隐藏**（多程里对调语义不明）。
- **输入框**：去掉左侧装饰用的 `>` 字符，避免看起来像可点击的提示符。
- **航线网格**：
  - 非枢纽城市也可以点击：选中后画出它到各直飞枢纽的弧线（原枢纽行为不变，画它的直飞城市）。
  - 任意城市的点悬浮即高亮（放大 + 珊瑚色），tooltip 按类型显示「枢纽航线/直飞城市」或「直飞枢纽 + 名称」。
  - 顶部统计去掉「151 枢纽航线」，只留城市与枢纽；两个数字都可悬浮/点击展开**按首字母分页（A–C、D–F…）**的名单，
    `全部` 之外每段一屏，列表可滚动。
- **常驻航线高亮**：`highlight = hover ?? 钉住的机票 ?? 当前会话最后一个报价`，因此首页对话里只要有报价
  （待确认或已出票），地图就持续画那条航线；状态栏显示「正在显示该航线」。
- **客票折叠**：`/tickets` 默认全部收起，一次只展开一张；**收起时不渲染条码**（不是隐藏，而是不进 DOM），
  扫码不会误读到别的票；收起态仍显示航线、出发时间与金额。
- 测试：新增域用例「出发时间必需、可解析、且不改变票价」，合计 54 例。

### P6 落地记录（缺陷修复）

- **城市名单悬浮即消失**：名单是 340px 宽的面板、触发点只是一个小按钮，指针从按钮斜向移入面板的途中会
  短暂落在两者之外，`mouseleave` 立刻关掉了它。改为「悬浮打开后，只有离开面板 / Esc / 点击面板外才关闭」，
  并在面板上用 220ms 的延迟关闭做缓冲。实测：指针扫过按钮→面板全程保持打开，移出后 300ms 内关闭。
  面板底色改为不透明 `bg-abyss-950`（原先 `/98` 会让地图点透上来）。
- **文案换行**：首页输入框上方那句中文在窄栏里把「票价」拆成两行。缩短为
  「用你自己的话描述行程：每一段航程与中转都会先报价，再出票。」并加 `text-balance`，不再出现残字换行。
  （P9 复测发现 `text-balance` 反而制造了换行，已移除，见 P9 记录。）
- **回复语言不跟随**：原先让模型"跟随用户语言"，混合语句（"new york能直飞哪些城市"）会跑成英文。
  现由界面语言决定：`systemPromptFor(lang)` 把「用简体中文作答」写进系统提示，城市名不翻译。
- **"直飞哪些城市"答不出来**：新增 `direct_destinations` 工具与 `lib/domain/network.ts`。
  枢纽 = 它连的枢纽 + 以它为枢纽的城市；非枢纽 = 它能直飞的枢纽；判定与 `isDirectFlight` 一致。
  实测：`New York 可直飞 65 个城市，其中 39 个是枢纽…`，工具轨迹可复核。
- 测试：新增域用例「直飞目的地与一次飞行判定一致」与 Agent 用例「direct_destinations」
  「回复语言由界面决定」，合计 57 例。

### P7 落地记录（需求复核发现的真实缺陷）

- **直飞判定用错了矩阵**：`isDirectFlight` 对枢纽↔枢纽读的是 Floyd–Warshall 的**全对最短路**，
  于是「任意两个枢纽都算直飞」。后果有两个：`verifyRoute` 抓不到跨多跳的枢纽航段；
  `direct_destinations` 把 New York 说成 65 个目的地 / 39 个枢纽。现在 `DomainGraph` 增加
  `hubLinks`（仅 `hub_links` 的邻接集合），判定与统计都改用它 —— New York 的真实直飞是
  **7 个枢纽 + 26 个城市 = 33 个**。回归测试锁住「未直连的枢纽对必须判为否」。
- **无服务城市的两步流程**：`resolve_city` 只回 `no_service`，把「找最近的可用城市」拆成独立工具
  `nearest_served_city`，因此对话的工具轨迹里能看到这一步（resolve_city → nearest_served_city），
  回答里带距离与依据（`locations.db` 坐标）。
- **不在数据集里的城市**：数据集没有该城市 = 没有坐标，**绝不编造距离**。`resolve_city` 回
  `not_found` 并给出最相近的已知城市（`suggestCities`，如 "new york city" → "New York"），
  `nearest_served_city` 在这种情况下只回 `no_coordinates`，不返回任何距离。
- **城市名单可点击**：名单每一项都是按钮，点击即在地图上选中该城市（与点城市点等价），并关闭名单。
- **交付物补齐**：`prompt history/` 目录与去密钥说明。
- 测试：62 例。

### P8 落地记录（多程成链 + 去掉工具噪音）

- **多程必须是一条链**：第 N+1 程从第 N 程的终点出发，只有第一程有真实出发地。
  `JourneyRequest.origin` 变为可选，`buildItinerary` 用上一程的终点补齐，接不上则抛
  `ItineraryError("broken_chain")`；`verifyItinerary` 把这条链**放在逐程 `verifyRoute` 之前**复核，
  这样被篡改的出发地报的是「第 2 程没有从 Split 接着飞」，而不是误导性的「路线不是从出发地开始」。
  敞口（open jaw）行程因此是非法输入 —— 这是有意的边界，不是遗漏。
  表单侧配合：续程只显示目的地选择框，并在上方标出「第 2 程 · 从 Split 出发」；上一程没选目的地时
  「+ 添加一程」置灰并给出原因。
- **工具轨迹不上屏**：`step` 事件与 `messages.tools_json` 照旧写（审计、排查、答辩时能证明工具真的被调用），
  但界面不再渲染工具条 —— 需求方明确要求「不要显式工具调用」，用户只看自然语言答案与报价卡片。
  `MessageBubble` 的 chips 与 `onStep` 回调一并删除，`live` 状态只剩 `{ text }`。
- **回答后不再有占位文案**：`ChatComposer` 新增 `showPlaceholder`，`/chat` 只在没有消息时给示例提示，
  首页线程模式恒为 `false`（那一屏本来就问过东西了）。`aria-label` 始终保留，无障碍不受影响。
- **「重新查询」清空一切**：出发地、目的地、所有续程、乘客名单、出发时间（回到明天 09:00）全部重置 ——
  之前只清了第一段，用户以为还在多程里。
- **工具响应的日期跟随界面语言**：`ToolContext.lang` 透传到 `itineraryPayload` / `ticketsPayload`，
  中文提问不会再出现「出发时间为 Oct 28, 09:00 AM」这种夹生句；数字仍由引擎给。
- 测试：63 例（新增「多程成链：后续程只写目的地」与「篡改出发地被拒绝」）。

### P10 落地记录（选中有动效）

- **选中城市点：星状扩散**。选中城市在点上叠 `animate-star`（四角星，0.24→2.4 倍、旋转 45°、淡出）与
  `animate-ripple`（单圈扩散环），周期 2.8s；它的直飞弧线改用 `animate-flow` 向外流动。**星形只用
  `sunset`**（与选中点的 ember 同色），没有引入新色相。
- **航线：有方向的流光**。金色航线之上叠一条 `strokeDasharray="600 120 360 120"` 的奶油色「彗星」——
  长头 + 短尾，一眼能看出方向；`stroke-dashoffset` 由 0 走到 −1200（`animate-flow`，1.8s linear），
  因为路径是按行程顺序 `arcPath(leg.from → leg.to)` 画的，负向偏移正好让彗星从出发地飞向目的地。
- **踩到的坑：单位不是像素**。viewBox 是 21040×11040，面板实际把它画在 ~0.02 的缩放下，1px ≈ 35 个单位。
  第一版把星星半径写成 150 个单位（≈4px）、虚线写成 `10 18`（≈0.3px），实测**肉眼完全看不见** ——
  动画在跑但屏幕上什么也没发生。所有几何量按「屏幕可见」重新定标：星半径 620、扩散环 r=420/stroke 34、
  弧线虚线 `100 100`、枢纽连线 `80 120`、彗星 `600 120 360 120`。
- **虚线周期必须整除偏移量**，否则每轮循环会跳一下：偏移 −1200，所以各虚线周期取 200 或 1200。
- **无障碍**：`prefers-reduced-motion: reduce` 下关闭星星、彗星与流动，只保留静态高亮（选中仍然看得出来）。
- 实测（可见窗口，非后台标签）：星形矩阵在 900ms 时 `scale≈1.76 / rotate 31.6°`，且无平移分量
  （说明是绕城市点而非视图中心缩放）；彗星 `stroke-dashoffset` 在 1.8s 内 0 → −1200 线性推进；
  钉住 Chengdu→New York 后地图只有该航线 + 「正在显示该航线」，城市星标让位。

### P11 落地记录（把"机器的事"从界面搬走）

- **星标太大**：上一版从 0.24 放大到 2.4 倍，实测在面板里是一个 ~25px 的光团，压住了城市与提示框。
  改为 **0.24 → 1.0**（扩散环 0.35 → 1.0，r 收到 560），峰值 ~10px，只在开始那一瞬亮、随后淡出。
- **删掉三处上屏的内部说明**（需求方圈出）：对话页标题栏的「前端预览 · 示例数据」徽标、全站页脚的
  「价格 = 距离 × 0.13 USD · 路线与票价均由 locations.db 计算」与「locations.db · read-only」、
  「我的机票」页顶那句「只有展开的客票会显示条码，扫码时不会误读到别的票」。
- **条码自己说话**：客票右上角条码下方加了 `Scan to verify` / 「扫码核验客票」（等宽 9px、ink-600），
  这样"这是扫码用的"由物件本身表达，不需要在列表上方写一段解释。
- **登录页**去掉 `NO SERVICE 10` 一行 —— 用户第一眼看到"我们服务不了 10 个城市"既突兀又无意义；
  现在只留 711 城市 / 40 枢纽 / 151 枢纽航线。
- **顺手清掉的其它内部痕迹**：报价单卡片底部的「总距离为各航段之和；价格 = 总距离 × 0.13 USD。」
  （与页脚同一句公式）、归档会话页标题前的「只读历史记录」、以及两个已无人使用的键
  （`map.badge`「抽象坐标」、`map.statNoService`「无服务」）。`quote.priceNote` / `footer.note` /
  `chat.previewBadge` / `tickets.barcodeHint` / `conversations.readOnly` 一并删除，双语同步。
- **规则写进技能**：ui-taste 的 Copy 段新增「Never narrate the machine」——界面上不放构建徽标、数据库名、
  只读、定价公式、我们的建模假设（"所有航班都可用"）、未覆盖城市数、以及"某个控件为什么这样"的解释；
  这些属于 README / PLAN。Honesty 段同步改写：不再要求"在界面上写出公式 / 声明抽象坐标"，
  改为要求**屏幕上各段距离必须加得出总价**，让读者自己就能复核。

### P9 落地记录（地图只显示一种高亮 + 去掉内部说明）

- **地图同时显示两种高亮**：之前「点击过的城市」与「正在悬浮的航线 / 会话里的航线」会叠在一起 ——
  点过 London 之后再悬浮下面某条机票，屏幕上仍是 London 的 23 条虚线弧与压暗的网络，机票航线被淹没，
  hover 结束又回到 London，用户无法判断现在看的是哪条。现在两者**互斥**：
  - 航线活跃（悬浮最近机票行，或右侧会话已经出了报价）→ 城市让位：不画城市的虚线弧、不压暗网络、不显示城市
    提示框，页脚显示「正在显示该航线」，只留金色航线。
  - 于是点城市（或城市名单里的条目）→ 航线让位，直到**航线本身变化**（`routeYieldedFor` 记着"是哪条航线
    让的位"）。悬浮类航线的让位状态在 `highlight` 清空时重置，否则同一条航线再次悬浮时会被历史让位挡住。
  - 实测：London 钉住 → 悬浮 Chengdu→New York 行：虚线弧 23→0、金色航线 2 条、页脚「正在显示该航线」；
    移开鼠标：虚线弧回到 23、页脚回到「London 清除」。会话出航线时同理，点 Tokyo 立刻切回 34 条虚线弧。
- **删掉三处内部说明**（需求方：内部假设或约束不要上屏）：
  - 乘客框下「逗号分隔；留空则为自己」——留空即账号本人是默认行为，不需要解释。
  - 出发时间下「任意时间均可 —— 我们假设所有航班都可选」——那是我们的模型假设，不是用户的问题。
  - 地图页脚「按 locations.db 中的坐标绘制 —— 抽象地图，并非真实地理」；登录页复用同一句，一并删除。
    坐标是抽象平面这件事保留在 README 与本文档里，属于交接说明而非界面文案。
- **换行又出现**：P6 给它加了 `text-balance`，而 `text-balance` 会把两行拉平 —— 明明一行放得下也强行断成
  两行，正好断在「航 / 程」之间。去掉 `max-w-[42ch]` 与 `text-balance`，并把与上方分隔标签重复的
  「用你自己的话描述行程：」删掉，只留「每一段航程与中转都会先报价，再出票。」；实测 1440 与 390 宽度下
  中英文都是单行不换行（`Range.getClientRects()` 只返回 1 个矩形）。

