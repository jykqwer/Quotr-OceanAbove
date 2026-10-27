# Ocean Above · 自然语言订票应用

面向航空公司 **Ocean Above** 的 Web 订票应用：用自然语言查航线、比价、确认后出票，并可回看全部机票与历史对话。
所有城市、坐标与航线均来自 `locations.db`（唯一数据源，只读）。

> 当前进度：**前端页面已完成（中英双语）**，接口由内存 mock 层提供，方便先验证交互与视觉。
> 域引擎（最短路线/计价）、SQLite 持久化与真实 LLM Agent 的实施方案见 [docs/PLAN.zh-CN.md](docs/PLAN.zh-CN.md)。

---

## 快速开始

```bash
npm install
cp .env.example .env.local   # 填入 LLM_API_KEY（DeepSeek / 任意 OpenAI 兼容服务）
npm run dev                  # http://localhost:3000
npm test                     # 域引擎单测（对比 Python oracle 的 golden fixtures）
npm run oracle               # 重新生成 golden fixtures
npm run verify:data          # oracle + 单测，数据变更后跑这个
```

- 需要 Node.js 20+（开发使用 Node 22）；`npm run oracle` 需要 Python 3。
- 演示账号：**用户名 `demo` · 密码 `oceanabove`**（首次启动自动播种示例数据）。
- 也可以直接在登录页注册新账号，新账号的机票与会话是空的，便于验证数据隔离。

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

报价单以**登机牌**形式呈现：FROM / TO 区块、虚线撕口、航段表（每段距离 + 中转城市）、中转与总距离、右下角沙色总价与条码；状态区分「待确认 / 已出票 / 已过期」。只有点击「确认出票」才会生成客票。

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
  mock/                      fixtures / mock agent / 内存 store / 会话 Cookie
docs/PLAN.zh-CN.md           需求梳理与实现计划（归档）
locations.db                 唯一数据源（只读）
```

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

## 安全与配置

- `.env.local` 已被 `.gitignore` 忽略，**不会**进入版本库；仓库里只提交 `.env.example` 占位符。
- 当前 mock 认证仅用于前端联调；真实实现将使用 scrypt 加盐哈希 + 服务端会话表（见计划文档 §9）。

## 已知限制（本阶段）

- 数据只存在内存中：重启 dev server 会重置为种子数据。
- 对话回复由**确定性规则**生成（`lib/agent/reply.ts`）：它只编排域引擎调用，不编造数字，但还不能理解复杂表述；LLM 工具循环尚未接入。
- 报价确认尚未绑定一次性 nonce（出票守卫在持久化阶段实现）。
