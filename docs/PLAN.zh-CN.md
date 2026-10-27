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
6. 加固（守卫测试、注入用例、降级）与交付文档

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

### P3 ��ؼ�¼

- **����ѭ��**��`lib/agent/loop.ts`����ϵͳ��ʾ�� + ��� 5 ����ģ��ֻѡ�������ǣ����߷���**�Ѹ�ʽ��**��չʾ�ַ�����`formatKm` / `formatUsd`����ģ��ֻ���ճ���
- **���߼�**��`lib/agent/tools.ts`����`resolve_city`�������� / �޷��񣩡�`find_route`���ڲ� `verifyRoute` ���ԣ����Ѳ���������ģ�ͣ���`create_booking_quote`������·������⣬�ž�ģ�ʹ����֣���`list_my_tickets`��**û���κγ�Ʊ����**��
- **��������**��`lib/agent/guard.ts`������������ = ȫ�����߽���г��ֵ����� token + �û�ԭ��������� + �۸��� 0.13��ģ���ı�������������ּ��в��ϸ�
- **��������**����Ʊ��϶�������booked / issued / paid / �ѳ�Ʊ ����һ�ɾܾ������������С�����Ϊģ��û�г�Ʊ������˵"�ѳ�Ʊ"��Ȼ�Ǽ١�
- ��һ�����ܾ� �� ����ȷ����ժҪ���������֣������ڹ켣���¼ `number_guard` / `claim_guard`��ʵ�⣺ģ�ͱ�ע��"ֱ�ӳ�Ʊ���� $1"ʱ���ظ����Ƿ��� + ����� $510.35��
- **��ʽ���**��`stream: true` ���� SSE��`user` / `step` / `delta` / `done` / `error`����ǰ��������Ⱦ��ʵʱ��ʾ���߹켣��`done` ��������Ϣ���ǲݸ壬��������Ҳ����ȷ���֡���������ʱ�ͻ����Զ����� JSON��
- �ȿӼ�¼��DeepSeek Ҫ��ع���ʷʱ `tool_calls[].type` ����Ϊ `"function"`������ 422�����߲�������������Ƭ����谴 `index` ƴ�ӡ�
- ���ԣ�`lib/agent/agent.test.ts` 16 ����������SSE �������������塢����������ע�롢�������������ޣ����ϼ� 43 ����
