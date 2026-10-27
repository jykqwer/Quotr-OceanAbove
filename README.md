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
```

- 需要 Node.js 20+（开发使用 Node 22）。
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
| `/login` | 登录 / 注册（含演示账号提示、语言切换） |
| `/chat` | 主对话页：会话列表 + 消息流 + 报价确认卡 + 输入框 |
| `/tickets` | 我的机票：总额、总里程与逐段行程 |
| `/conversations` | 全部历史会话，可进入只读回看 |

报价卡会展示**每一段航程、中转城市、总飞行距离与总价**，并区分「等待确认 / 已出票 / 已过期」三种状态；
只有点击「确认并出票」才会生成客票。

## 目录结构

```
app/
  layout.tsx                 根布局（读语言 Cookie、注入 i18n Provider）
  login/                     登录页
  (app)/                     需登录的页面外壳（AppShell + 导航）
    chat/  tickets/  conversations/
  api/                       登录、会话、对话、报价确认、机票接口
components/                  图标、导航、消息气泡、报价卡、行程时间轴、机票卡、登录表单
lib/
  types.ts                   领域类型
  format.ts                  USD / km 统一格式化（en-US，逐段可复核）
  i18n/                      中英文案与语言上下文
  api/client.ts              前端调用的类型化 API 客户端
  mock/                      fixtures / mock agent / 内存 store / 会话 Cookie
docs/PLAN.zh-CN.md           需求梳理与实现计划（归档）
locations.db                 唯一数据源（只读）
```

## 计算口径

- 距离为 `locations.db` 中两城坐标的欧氏距离（km）。
- 段距保留 2 位小数，**总距离 = 各段之和**，**价格 = 总距离 × 0.13 USD**（保留 2 位小数）。
  因此用户可以把每段数字加起来复核总价，不会出现展示漂移。
- 只会经过枢纽中转换乘；当前页面中的示例数字均按此口径由真实数据算出。

## 安全与配置

- `.env.local` 已被 `.gitignore` 忽略，**不会**进入版本库；仓库里只提交 `.env.example` 占位符。
- 当前 mock 认证仅用于前端联调；真实实现将使用 scrypt 加盐哈希 + 服务端会话表（见计划文档 §9）。

## 已知限制（本阶段）

- 数据只存在内存中：重启 dev server 会重置为种子数据。
- 对话回复由规则化 mock 生成，仅覆盖少量示例航线，尚未接入 LLM 与真实路线引擎。
- 报价确认尚未绑定一次性 nonce（当前整份页面即为预览构建），出票守卫将在持久化阶段实现。
