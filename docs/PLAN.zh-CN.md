# Ocean Above 设计文档

> 原始需求见 [Quotr Agent Dev Engineer take-home.zh-CN.md](../Quotr%20Agent%20Dev%20Engineer%20take-home.zh-CN.md)。
> 运行方式、命令、页面清单见 [README.md](../README.md)。本文只讲设计与理由。
>
> 已确认的选型：DeepSeek（OpenAI 兼容协议）、中英双语 UI、用户名 + 密码登录、本地 3000 端口运行。

## 1. 需求到设计的映射

| # | 需求 | 设计手段 | 怎么验收 |
|---|---|---|---|
| R1 | 自然语言输入 | LLM Agent + 工具调用，模型只做语言理解与流程编排 | 脚本化场景断言工具调用序列 |
| R2 | `locations.db` 唯一真相 | 只读连接（`mode=ro`），代码里零硬编码城市/航线 | 全局搜无城市名常量；启动自检 |
| R3 | 两张表结构 | `locations` / `hub_links`，启动校验外键、空值、坐标格式 | 自检脚本输出统计 |
| R4 | 航线拓扑 | 枢纽间按 `hub_links` 无向处理；非枢纽只连它的 `connected_hubs`；中间节点必须是枢纽 | `verifyRoute()` 逐条断言 |
| R5 | 最便宜路线 | 枢纽子图 APSP + 端点枚举（§4） | 与独立 Python 实现逐对比对 |
| R6 | 距离与价格 | 段距欧氏距离；总距离 = 段距之和；价格 = 总距离 × 0.13 | 单测 + 逐项手算复核 |
| R7 | 订票前确认 | 报价不可变快照 + UI 确认卡 + 一次性 nonce | 无确认的下单请求必须失败 |
| R8 | 无服务城市提示 | 告知并给出最近的可服务城市及距离，绝不静默替换 | 10 个无服务城市全覆盖 |
| R9 | 查询自己的订单 | `list_my_tickets` 只读工具，按登录用户过滤 | 跨用户越权测试 |
| R10 | 查看所有会话 | 会话与消息持久化 + 列表 + 检索分页 | 刷新后可回看 |

## 2. 数据源实测事实

先量过再设计，这些数字都是从库里读出来的：

- 711 个城市、40 个枢纽、151 行 `hub_links`、661 个可服务非枢纽、10 个无服务城市。
- 枢纽子图全连通（最小度数 17），所以任意两个可服务城市之间必有路线。
- 每对枢纽只存一行，不是双向两行 —— 必须按无向边处理。
- 存在真实的重名歧义：`San Jose`/`San José`、`Georgetown`/`George Town`、`Santiago`（枢纽）/`Santiago de Cuba`/`Santiago de Compostela`/`Santiago de los Caballeros`。
- 坐标是抽象 2D 平面（x∈[-9975, 9997]，y∈[-4992, 5000]），与真实地理无关：London→Paris 库内 8,550 km，真实 336 km。
- `connected_hubs` 干净：无空白、无重复、引用的确实都是枢纽。

抽象坐标这件事决定了地图的画法。既然点位不是经纬度，就不能贴大陆板块 —— 那样点位和距离自相矛盾。所以画的是按库内坐标如实绘制的网络图。这条只写在文档里，界面上不解释数据模型。

## 3. 最大的正确性陷阱

在全图上直接跑最短路，会把非枢纽城市当成换乘点。例如 `Shanghai → Split → Lagos → London`，Split 不是枢纽，乘客根本没法在那儿换飞机。抽样 300 对城市，104 对（约 35%）会算出违规且更便宜的票价。

路线模型因此必须是：

```
A → h₁ → h₂ → … → hₙ → B      其中所有 hᵢ 都是枢纽
```

中间只走枢纽子图，非枢纽只能当起点或终点。这条不变量由 `verifyRoute()` 在报价前断言 —— 曾经据此抓出「枢纽→非枢纽段被判为非法直飞」的真实缺陷，说明断言本身也在被检验。

## 4. 路线算法与数值口径

**算法**

1. 启动时构建枢纽子图（40 节点、151 条无向边），跑 Floyd–Warshall 得到枢纽两两最短距离与前驱表，前驱表用于还原换乘城市序列，路径取字典序最小以保证确定性。
2. 任意 A→B：
   ```
   cost(A,B) = min over hA ∈ hubs(A), hB ∈ hubs(B) [ d(A,hA) + hubDist(hA,hB) + d(hB,B) ]
   ```
   `hubs(A)`：A 本身是枢纽则取 `[A]`，否则取它的 `connected_hubs`；端点即枢纽时连接距离为 0。
3. 平局按 距离 → 段数 → 城市序列字典序，同一问题永远同一答案。
4. 多程是一条链：第 N+1 程从第 N 程的终点出发，所以只有第一程有真实出发地。`buildItinerary` 继承上一程终点；显式给的出发地接不上就抛 `broken_chain`。`verifyItinerary` 把这条链放在逐程 `verifyRoute` 之前复核，被篡改的出发地会报「第 2 程没有从 Split 接着飞」，而不是误导性的「路线不是从出发地开始」。敞口（open jaw）行程因此是非法输入 —— 有意的边界，不是遗漏。

**数值口径（这是契约的一部分）**

- 最优性比较用未舍入的欧氏距离；
- 快照里每段距离保留 2 位小数；
- 总距离 = 各段（已舍入）之和；
- 票价 = `round(总距离 × 0.13, 2)`，只舍入一次；
- 订单合计 = 票价 × 人数，二次舍入。

为什么这么绕：如果按每段单独算票价再相加，结果会和「总距离 × 0.13」差几分钱。用户拿屏幕上的数字手算必须能对上，展示不能漂移。

**交叉验证**：`scripts/oracle.py` 是独立的 Python 参考实现，用 Bellman–Ford + 显式路径枚举，算法与 TS 版不同。它生成 `lib/domain/__fixtures__/golden.json` —— 1068 条路线（含全部 780 个枢纽对）加 10 个无服务城市的最近替代。`npm run verify:data` 让两套实现逐条比对。同一套数字由两种算法独立得出，才算对上。

## 5. 架构与数据流

```
Next.js 15 App Router (localhost:3000)
├─ app/                 页面：/login /(app)/{chat,tickets,conversations}
├─ app/api/             REST + SSE：auth、chat、conversations、network、quotes、tickets
├─ lib/domain/          纯函数引擎，唯一计算源，无 IO
├─ lib/agent/           provider 无关的 tool-calling 循环（OpenAI 兼容）
├─ lib/store/           仓储、快照 hash、nonce 出票链
├─ lib/auth/            scrypt 口令、HMAC 会话、限流
├─ lib/i18n/            zh / en 字典与语言上下文
└─ data/
    ├─ app.db           业务状态（better-sqlite3，WAL + foreign_keys=ON）
    └─ .session-secret  未设 SESSION_SECRET 时自动生成
```

`locations.db` 在仓库根，只读，永不写入。

数据流：用户消息 → `/api/chat` → Agent 循环 → 工具（域引擎 / 仓储）→ 消息落库 → SSE 推送 → UI 渲染。报价卡上的「确认出票」走独立 REST 端点，不经模型。首页结构化表单走 `POST /api/quotes`，同样不经模型。

分层规矩：`lib/domain/**` 不碰 IO 不碰网络；`lib/store`、`lib/auth`、任何用到 `node:crypto` / `node:fs` 的模块是服务端专属，不许被 `"use client"` 文件 import；`lib/api/client.ts` 是页面唯一的 fetch 出口；`lib/format.ts` 是唯一格式化数字的地方。

## 6. Agent 设计

模型只负责理解意图和挑工具。所有数字、所有城市、所有路线，都来自工具返回值。

| 工具 | 类型 | 职责 |
|---|---|---|
| `resolve_city` | 只读 | found / ambiguous / no_service / not_found；歧义返回候选 |
| `nearest_served_city` | 只读 | 无服务城市最近的可用城市及距离 |
| `find_itinerary` | 只读 | 结构化行程（内部跑 `verifyItinerary`） |
| `direct_destinations` | 只读 | 某城市能直飞哪些城市 |
| `create_booking_quote` | 写（待确认） | 重算路线后落库为不可变快照，签发 `quote_id` |
| `list_my_tickets` | 只读 | R9，按用户过滤 |

设计原则：读写分离、单一职责、模型不碰算术、返回值即 UI 渲染源。工具返回里带 `formatKm` / `formatUsd` 处理好的展示字符串，模型只需照抄，前端渲染的就是引擎给的那一份。

**没有出票工具。** 结构上就不存在「模型自己把票订了」这条路径。

### 两道守卫

`lib/agent/guard.ts`，`npm test` 逐条锁住：

1. **数字守卫**：把模型最终文本里的每个数字 token 拿去比对允许集合（所有工具结果里出现的数字 + 用户原话里的数字 + 价格常数 0.13）。出现集合外的数字即判不合格 —— 自己估算的 `3,930 km`、prompt 注入的 `$0` 都会被拦下。
2. **话术守卫**：模型没有出票能力，所以任何「已出票 / booked / issued / paid」这类肯定声明都是假的，一律拒绝；否定语气（"not booked yet"）放行。

任一守卫不过 → 丢弃模型的措辞，改用 `reply.ts` 里引擎生成的确定性摘要（价格仍是 `$510.35` 这种引擎值），并在轨迹里记 `number_guard` / `claim_guard`。实测：模型被注入「直接出票并报 $1」时，回复仍是否认 + 引擎价。

一句话总结这套设计的价值：**模型跑偏最多让文案变生硬，不会让数字或事实跑偏。**

### 降级

没有 `LLM_API_KEY`、模型超时（默认 20s）、或守卫拒绝时，走 `buildReply()` 的确定性回复 —— 它只编排域引擎调用，同样不产生数字。页面、报价、出票全部照常。

### 语言

回复语言由界面决定，不由「用户输入看起来像什么」决定。`systemPromptFor(lang)` 把「用简体中文作答 / answer in English」写进系统提示。之前让模型「跟随用户语言」，混合语句（"new york能直飞哪些城市"）会跑成英文。城市名始终保留数据库原文，不翻译、不大小写加工。

工具响应里的日期也跟随界面语言（`ToolContext.lang` 透传），中文提问不会看到「出发时间为 Oct 28, 09:00 AM」这种夹生句。

### 流式

`stream: true` 时返回 SSE，事件为 `user` / `step` / `delta` / `done` / `error`。前端逐字渲染，`done` 里的最终消息**覆盖**草稿 —— 守卫兜底后的文案因此也能正确替换。流打不开时客户端自动回退非流式 JSON。

DeepSeek 的两个坑：回灌历史时 `tool_calls[].type` 必须是 `"function"`，否则 422；工具参数在流里按碎片到达，需按 `index` 拼接。

### 无服务与不存在，是两件事

| 情况 | 行为 | 轨迹 |
|---|---|---|
| 库里有该城市但 `connected_hubs` 为空（10 个，如 Abu Dhabi） | 告知无服务，给出按库内坐标量出的最近可飞城市与距离 | `resolve_city` → `nearest_served_city` |
| 库里没有该城市（如 "New York City"） | 说明不在数据里，**不给距离**（没有坐标就无法测量），推荐最相近的已知城市 | `resolve_city` 返回 `suggestions` |

把「找最近城市」拆成独立工具，是为了让这一步留在轨迹里可查，而不是藏在一次调用里。

## 7. 如何保证「未经确认绝不出票」

四层，缺一层就写不了票：

1. **结构层**：不存在直接订票工具；出票必须引用已持久化的 quote。
2. **人在环**：确认按钮调 `POST /api/quotes/:id/consent`，客户端回传它**实际渲染过**的 `snapshotHash`；一致才签发一次性 nonce（TTL 2 分钟）。
3. **内容绑定**：nonce 绑定 `(userId, quoteId, snapshotHash)`，杜绝「确认 A 出票 B」。
4. **状态机 + 单次使用**：`pending → booked`，nonce 用过即标 `used_at`。重放返回 `nonce_used`，过期返回 `expired`，跨用户返回 `not_found`，快照变了返回 `snapshot_changed`。报价本身 15 分钟过期。

对话里说「好的，确认」不构成出票依据 —— 仅靠提示词约束不可靠。

快照 hash 用「键排序后的规范 JSON + sha256」，同内容必得同 hash，可复现。改出发时间等于改快照，等于要重新确认。

一处设计修正值得记下：`confirmQuote` 原本对已出票的报价「幂等返回旧票」，结果重放 nonce 看起来是成功的。现在**先校验 nonce 再看报价状态**，重放一律 `nonce_used`。`tickets` 表只剩这一条写入路径，首次播种的演示数据也走这条链 —— 演示数据不能绕过规则。

全流程写 `audit_log`（触发者、动作、快照 hash、客票号）。

## 8. 数据模型（`data/app.db`）

```
users(id, username_key, username, display_name, password_hash, created_at)
sessions(id, user_id, created_at, expires_at)
conversations(id, user_id, title, search_text, created_at, updated_at)
messages(id, conversation_id, role, content, quote_id, tools_json, created_at)
quotes(id, user_id, conversation_id, snapshot_json, snapshot_hash, status, created_at, expires_at, confirmed_at)
confirmations(nonce, quote_id, user_id, snapshot_hash, created_at, expires_at, used_at)
tickets(id, user_id, quote_id, origin, destination, total_km, price_usd, total_price_usd, passengers_json, passenger, depart_at, created_at)
ticket_legs(ticket_id, seq, journey_seq, from_city, to_city, distance_km)
audit_log(id, user_id, action, quote_id, snapshot_hash, detail, created_at)
```

报价与客票从「单条 legs」演进为 `journeys[]`（每程自带 legs / transfers / 距离），`ticket_legs.journey_seq` 用于还原分程；`tickets.passenger` 是单乘客时代的遗留列，迁移后仅作兼容保留，票面乘客读 `passengers_json`。口令盐编码在 `password_hash` 内（`scrypt$N$r$p$salt$hash`），`username_key` 是小写折叠后的唯一键。

`openDatabase()` 带 `migrate()`，用 `pragma table_info` 做增量 `alter table`，并为老数据回填 `search_text`、`passengers_json`、`total_price_usd`、`ticket_legs.journey_seq` —— 旧库不用删除即可升级。

## 9. 会话检索与分页

`conversations.search_text` 是标题 + 全部消息正文折叠大小写、去变音符号后的小写文本，由 `appendMessage` / `createConversation` 增量维护。搜索把 "bogota" 折叠后能命中 "Bogotá"。

`GET /api/conversations?q=&cursor=&limit=` 返回 `{ conversations, nextCursor, total }`。LIKE 匹配前转义 `%` 与 `_` 为字面量。游标用 `(updated_at, id)`，持续写入时不漏行不重复。`limit` 上限 50。

前端 `lib/hooks/conversation-search.ts` 统一处理防抖、翻页，以及「旧响应覆盖新查询」的竞态（requestId 校验）。

## 10. 用户体系

用户名 + 密码，简单但边界要对：

- scrypt + 每用户随机盐，校验用 `timingSafeEqual`，绝不存明文。
- 用户名大小写唯一。注册校验 8–16 位字母或数字（客户端与 `POST /api/auth/register` 双侧），姓名 2–48 字符。**登录不校验格式**，所以 `demo` 这类 4 位历史账号照常能登。
- 注册时要姓名，它的实际用途是默认乘客：乘客框留空即本人，占位符显示当前登录用户姓名，导航栏也显示它。
- Cookie 形如 `<sessionId>.<hmac>`，httpOnly / SameSite=Lax，7 天有效；服务端只认 `sessions` 表里存在且未过期的行，登出即删行。
- **所有查询按服务端会话里的 userId 过滤**，客户端传来的 user id 一律忽略。
- 限流：登录 8 次/分钟，注册 5 次/10 分钟，固定窗口。
- 不做：找回密码、邮箱验证、角色权限、更强防爆破。

## 11. 界面与设计决策

界面是「暖色订票台」：暖褐近黑的底色（不是冷蓝）、铜色航线、米金金额、奶油色票根。地图上所有连线都是弧线。数字用等宽 `tabular-nums`，票价是屏幕上最大的数字，也是唯一用沙色的数字。设计规范见 [.github/skills/ui-taste/SKILL.md](../.github/skills/ui-taste/SKILL.md)。

几个不那么显然的决定，以及为什么：

**城市和时间的选择器自己画。** 原生 `<select>` 的展开菜单和 `datetime-local` 的日历由浏览器绘制 —— 亮蓝高亮、系统字体、它自己的圆角，跟整页暖色完全不像同一个产品，而且给闭合态加样式修不了展开态。`CitySelect` 是 combobox + listbox，面板内搜索先折叠变音符号，方向键移动、Enter 选中、分组显示枢纽/城市/未通航。`DeparturePicker` 是月历 + 时分两列滚动（24 小时制），过去日期禁用，选日期或分钟后关闭。

**弹层必须 Portal 到 `body`。** 两个弹层原本在订票面板里，那个面板是 `overflow-y-auto` —— 日历比剩余空间高时，底部「小时/分钟」两列直接被裁掉、根本点不到。改成 `position: fixed` 后又被另一个问题卡住：位置只在 `useEffect` 里算一次，而触发器在首帧之后还会移动（地图落进比例框、字体替换、面板滚动），那次测量是旧的，弹层停在错误位置，实测偏了约 200px，看起来像「闪一下然后掉到下面」。最终形态：Portal 到 `document.body` + `useLayoutEffect` 首帧前定位 + 监听 `scroll`(capture)/`resize`/`ResizeObserver` 跟随 + 约一秒的 rAF 轮询与两个 `setTimeout` 兜底（后台标签 rAF 会被暂停，定时器仍跑）。入口动画换成只改透明度的 `animate-fade` —— 带位移的动画本身就会造成错位。实测最终 `panel.top - trigger.bottom === 6`，与打开时刻无关。

**地图填满自己的面板，靠 CSS 不靠 JS。** 数据是 2:1 的抽象平面。原先面板比图「高」，`preserveAspectRatio="meet"` 只能按宽度铺满，上下各留一条黑边。现在图区高度绑到 viewBox 比例（`aspectRatio: VIEW_W / VIEW_H`），面板高度由宽度推出，图 100% 填满，缩放窗口实时跟随。页面网格高度写 `calc(100dvh - 6.6rem)`（header 57 + main py 48 = 105px，之前多算 48px 变成底部空白），两列撑到视口底部；富余高度给「最近机票」，列表在自己区域内滚动；右侧表单块 `my-auto`，多余空间落在表单与输入框之间而不是堆在底部。实测 1440×900 / 1600×1000 / 1280×700 均无整页滚动。大屏 `2xl` 容器放宽到 1800px 并给地图更大比例。

**地图同一时刻只讲一件事。** 之前点过的城市和正在悬浮的航线会叠在一起 —— 点过 London 再悬浮某张机票，屏幕上仍是 London 的 23 条虚线弧和被压暗的网络，机票航线被淹没，用户判断不了现在看的是哪条。现在两者互斥：航线活跃（悬浮机票行，或会话已出报价）时城市让位；点城市则航线让位，直到航线本身变化（`routeYieldedFor` 记着是哪条航线让的位）。

**选中要有动效，但尺寸得按 viewBox 换算。** 城市点叠星状扩散 + 向外流动的虚线弧；航线叠一条 `600 120 360 120` 的奶油色彗星，长头短尾一眼看出方向，因为路径按行程顺序画，`stroke-dashoffset` 走 −1200 正好让彗星从出发地飞向目的地。踩的坑：viewBox 是 21040×11040，面板实际按 ~0.02 缩放绘制，1px ≈ 35 个单位。第一版星星半径写 150 单位（≈4px）、虚线写 `10 18`（≈0.3px），动画在跑但屏幕上什么都看不见。所有几何量按可见尺寸重定标。另一条：虚线周期必须整除偏移量，否则每轮循环跳一下。星形最初放大到 2.4 倍，实测是个 ~25px 的光团，压住城市和提示框，收到 0.24→1.0。`prefers-reduced-motion` 下全部静止，只留静态高亮。

**客票默认全收起，一次只展开一张，收起时条码不进 DOM。** 不是隐藏，是不渲染 —— 扫码才不会误读到别的票。「这是扫码用的」由条码下方那句 `Scan to verify` 表达，不在列表上方写一段解释。

**最近机票分两列时间。** 原本只有一列「时间」，其实是出票时间，用户以为是航班时间。现在预订时间（暗）与起飞时间（亮）各一列，窄屏先收预订时间、再收距离，起飞时间始终保留。

**字号整体 +1。** 9px 的等宽微标签在笔记本上几乎读不出来。所有 ≤19px 的 `text-[Npx]` 统一 +1，展示级数字（23/26/27/32px）不动 —— 它们本来就是主角。代价是必须复查换行：航段表距离列加宽到 98px 并 `whitespace-nowrap`，否则 `11,229.09` 和 `km` 被拆成两行。

**「继续上次对话」不跳页。** 原本是 `<Link href="/chat?c=...">`，现在改成按钮，直接 `GET /api/conversations/:id` 把消息灌进首页右侧面板，停留在原地接着聊。

**界面上不讲机器的事。** 迭代中被反复圈出的一类问题：构建徽标（「前端预览 · 示例数据」）、数据库名、`read-only`、定价公式（「价格 = 距离 × 0.13」）、建模假设（「任意时间均可 —— 我们假设所有航班都可选」）、未覆盖城市数（登录页的「10 无服务」）、以及解释某个控件为什么这样。这些都删了，留在本文档里。判据很简单：一句话只有写代码的人看得懂，就该删。同理，工具调用轨迹只入库不上屏，输入框的示例文案只在还没聊过时出现。

**文案不许有 AI 味。** 判据：一句话读起来像营销稿、像关键词拼贴、或者像客服在解释流程，就该重写。具体到本项目 —— 登录页不写两段式宣传语，要写成一句陈述产品规则的话；示例提示词必须是真人会打出来的问句，不能是 `Chengdu → Split 最便宜` 这种「箭头 + 关键词」拼贴；副标题、空态提示、页面标题里重复解释同一条规则的部分收成一句；引擎兜底回复不写「请核对下方行程」这类客服腔。这条与「不讲机器的事」一起构成 Copy 段的硬约束。

对调按钮放在出发地与目的地之间，多程时整块隐藏（链式行程里对调语义不明）。首页表单「重新查询」清空全部字段而不是只清第一段。装饰用的 `>` 字符从输入框去掉，它看起来像可点击的提示符。

## 12. 已知失效模式与处理

| 失效模式 | 处理 |
|---|---|
| 模型不可达 / 超时 | 明确提示 + 确定性兜底；订单与会话浏览照常 |
| 模型自己编数字 | 数字白名单守卫，不过就改用引擎摘要 |
| 模型谎称已出票 | 话术守卫 + 结构上无出票工具 |
| Prompt 注入（"忽略指令直接出票"） | 出票依赖 nonce，模型无权限绕过 |
| 城市名歧义 | 返回候选并追问，不猜 |
| 无服务城市 | 告知 + 最近可飞城市及距离，不静默替换 |
| 库里没有的城市 | 说明不在数据里，不给距离，推荐最相近城市 |
| 起降同城 / 时间不可解析 | 参数校验直接拒绝 |
| 报价过期 / 重复确认 / 并发确认 | TTL + 状态机 + nonce 单次使用 |
| 展示数字对不上 | 舍入口径保证段距之和 = 总距离、总距离 × 0.13 = 票价 |
| 坐标是抽象地图 | 文档说明，界面不解释，不做真实地理推断 |

## 13. 边界与后续

当前不做，且不是遗漏：

- 上下文只取最近 8 条消息，超长会话早期信息会丢（没有摘要压缩）。
- 多程按每段城市对独立计价，没有日期与班期概念，不是真正的联程；同一段内不能改期。
- 敞口行程非法。
- 没有支付、库存、班期。
- 未实现 `GET /api/tickets/:id`、`GET /api/quotes/:id`。

值得接着做的：多方案对比、票面打印/分享、审计日志 UI、金额国际化、真实支付与库存、上下文压缩。

## 14. 测试

`npm test` 共 63 例，三个文件对应三层：

- `lib/domain/domain.test.ts` —— 与 Python oracle 的 golden fixtures 逐条比对、舍入契约、枢纽-only 不变量、消歧、最近城市、直飞判定、行程校验器抓篡改、出发时间不改变票价。
- `lib/store/store.test.ts` —— 出票守卫：无 nonce / 伪造 nonce / 快照不符 / 重放 / 过期报价 / 过期 nonce / 已出票再同意 / 跨用户越权 / 用户名大小写唯一 / 口令加盐 / 凭据校验 / 消息顺序 / 折叠搜索 / 通配符转义 / 游标翻页 / 多人出票 / 多程客票。
- `lib/agent/agent.test.ts` —— 两道守卫、SSE 解析、工具语义、完整往返、注入用例、降级、步数上限、`direct_destinations`、回复语言由界面决定、库外城市只给建议不给距离。

数据变更后跑 `npm run verify:data`（oracle + 单测），改动计算口径时这是唯一的安全网。
