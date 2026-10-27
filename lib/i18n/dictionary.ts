import type { Lang } from "@/lib/types";

const en = {
  "brand.name": "Ocean Above",
  "brand.tagline": "One ticket, every ocean",

  "nav.chat": "Chat",
  "nav.tickets": "My tickets",
  "nav.conversations": "Conversations",
  "nav.signOut": "Sign out",

  "lang.label": "Language",

  "auth.signInTitle": "Welcome aboard",
  "auth.signUpTitle": "Create your account",
  "auth.subtitle": "Sign in to book flights with Ocean Above.",
  "auth.signUpSubtitle": "One account for every ticket you book.",
  "auth.username": "Username",
  "auth.password": "Password",
  "auth.usernamePlaceholder": "e.g. adaLovelace",
  "auth.passwordPlaceholder": "At least 8 characters",
  "auth.signIn": "Sign in",
  "auth.signUp": "Create account",
  "auth.signingIn": "Signing in…",
  "auth.creating": "Creating account…",
  "auth.switchToSignUp": "New here? Create an account",
  "auth.switchToSignIn": "Already have an account? Sign in",
  "auth.demoTitle": "Demo account",
  "auth.demoHint": "username demo · password oceanabove",
  "auth.errUsername": "Username must be 3–32 characters.",
  "auth.errPassword": "Password must be at least 8 characters.",
  "auth.errInvalid": "Incorrect username or password.",
  "auth.errTaken": "That username is already taken.",
  "auth.errGeneric": "Something went wrong. Please try again.",

  "login.heroTitle": "Book the ocean, in plain words.",
  "login.heroSubtitle":
    "Tell Ocean Above where you want to go. It finds the cheapest route, spells out every leg and transfer, and books only after you confirm.",
  "login.feature1": "Cheapest route across 40 hub airports",
  "login.feature2": "Every leg, transfer and fare shown before booking",
  "login.feature3": "All your tickets and conversations in one place",

  "chat.newChat": "New conversation",
  "chat.title": "Ask Ocean Above",
  "chat.subtitle": "Natural-language booking, quoted before anything is issued.",
  "chat.placeholder": "e.g. Cheapest flight from Chengdu to London",
  "chat.send": "Send",
  "chat.sending": "Sending…",
  "chat.emptyTitle": "Where would you like to fly?",
  "chat.emptyHint":
    "Describe the trip in your own words. I'll find the cheapest route, show every leg and transfer, and only book after you confirm.",
  "chat.previewBadge": "Preview build · sample data",
  "chat.tools": "Tools",
  "chat.you": "You",
  "chat.assistant": "Ocean Above",
  "chat.thinking": "Working on it…",
  "chat.errorGeneric": "Something went wrong. Please try again.",
  "chat.history": "Conversations",
  "chat.noHistory": "No conversations yet",

  "quote.title": "Fare quote",
  "quote.pending": "Awaiting confirmation",
  "quote.booked": "Booked",
  "quote.expired": "Expired",
  "quote.route": "Route",
  "quote.leg": "Leg {n}",
  "quote.transferAt": "Transfer at {city}",
  "quote.direct": "Direct flight",
  "quote.transfers": "{count} transfers",
  "quote.transfersLabel": "Transfers",
  "quote.totalDistance": "Flight distance",
  "quote.totalPrice": "Total price",
  "quote.priceNote": "Distance is the sum of all legs; price = distance × 0.13 USD.",
  "quote.confirm": "Confirm & book",
  "quote.confirming": "Booking…",
  "quote.confirmed": "Ticket issued",
  "quote.expires": "Quote valid for 15 minutes",
  "quote.bookedNote": "Ticket {id} issued — see My tickets.",
  "quote.confirmError": "Booking failed. The quote may have expired.",
  "quote.ticketFor": "One ticket · all legs included",

  "tickets.title": "My tickets",
  "tickets.subtitle": "Every ticket you booked with Ocean Above.",
  "tickets.empty": "No tickets yet",
  "tickets.emptyHint": "Confirm a quote in chat and it will appear here.",
  "tickets.count": "{count} tickets",
  "tickets.totalCount": "Tickets booked",
  "tickets.totalSpend": "Total spend",
  "tickets.totalDistance": "Total distance",
  "tickets.bookedAt": "Booked {time}",
  "tickets.bookedAtLabel": "Booked at",
  "tickets.passenger": "Passenger",
  "tickets.ticketId": "Ticket",
  "tickets.bookAgain": "Ask for another flight",

  "conversations.title": "Conversations",
  "conversations.subtitle": "Everything you have asked Ocean Above.",
  "conversations.empty": "No conversations yet",
  "conversations.emptyHint": "Start a chat and your history will show up here.",
  "conversations.messages": "{count} messages",
  "conversations.updated": "Updated {time}",
  "conversations.open": "Open",
  "conversations.back": "All conversations",
  "conversations.notFound": "Conversation not found.",
  "conversations.readOnly": "Read-only history",

  "common.loading": "Loading…",
  "common.retry": "Retry",
  "common.error": "Request failed",
  "common.new": "New",
  "common.perLeg": "per leg",
  "common.startChat": "Start chatting",

  "footer.note":
    "Routes and fares are computed from locations.db · price = distance × 0.13 USD",
} as const;

export type DictKey = keyof typeof en;
type Dictionary = Record<DictKey, string>;

const zh: Dictionary = {
  "brand.name": "Ocean Above",
  "brand.tagline": "一张机票，飞越重洋",

  "nav.chat": "对话",
  "nav.tickets": "我的机票",
  "nav.conversations": "历史会话",
  "nav.signOut": "退出登录",

  "lang.label": "语言",

  "auth.signInTitle": "欢迎登机",
  "auth.signUpTitle": "创建账户",
  "auth.subtitle": "登录后即可通过 Ocean Above 预订机票。",
  "auth.signUpSubtitle": "一个账户，管理你的所有机票。",
  "auth.username": "用户名",
  "auth.password": "密码",
  "auth.usernamePlaceholder": "例如 adaLovelace",
  "auth.passwordPlaceholder": "至少 8 位字符",
  "auth.signIn": "登录",
  "auth.signUp": "注册",
  "auth.signingIn": "登录中…",
  "auth.creating": "注册中…",
  "auth.switchToSignUp": "还没有账户？立即注册",
  "auth.switchToSignIn": "已有账户？去登录",
  "auth.demoTitle": "演示账户",
  "auth.demoHint": "用户名 demo · 密码 oceanabove",
  "auth.errUsername": "用户名需为 3–32 个字符。",
  "auth.errPassword": "密码至少 8 位字符。",
  "auth.errInvalid": "用户名或密码不正确。",
  "auth.errTaken": "该用户名已被占用。",
  "auth.errGeneric": "出了点问题，请重试。",

  "login.heroTitle": "用一句话，订一张跨洋机票。",
  "login.heroSubtitle":
    "告诉 Ocean Above 你想去哪里。它会找出最便宜的路线，逐段列出中转城市与票价，只有在你确认之后才会出票。",
  "login.feature1": "在 40 个枢纽机场之间找出最便宜路线",
  "login.feature2": "出票前展示每一段航程、中转与票价",
  "login.feature3": "机票与历史对话集中在一处",

  "chat.newChat": "新建对话",
  "chat.title": "向 Ocean Above 提问",
  "chat.subtitle": "用自然语言订票，出票前必定先报价确认。",
  "chat.placeholder": "例如：成都到伦敦最便宜的航班是哪一班？",
  "chat.send": "发送",
  "chat.sending": "发送中…",
  "chat.emptyTitle": "想去哪里？",
  "chat.emptyHint": "用你自己的话描述行程。我会找出最便宜的路线，列出每一段与中转城市，并在你确认后才出票。",
  "chat.previewBadge": "前端预览 · 示例数据",
  "chat.tools": "工具调用",
  "chat.you": "你",
  "chat.assistant": "Ocean Above",
  "chat.thinking": "正在处理…",
  "chat.errorGeneric": "出了点问题，请重试。",
  "chat.history": "历史对话",
  "chat.noHistory": "暂无对话",

  "quote.title": "报价单",
  "quote.pending": "等待确认",
  "quote.booked": "已出票",
  "quote.expired": "已过期",
  "quote.route": "行程",
  "quote.leg": "第 {n} 段",
  "quote.transferAt": "在 {city} 中转",
  "quote.direct": "直飞",
  "quote.transfers": "{count} 次中转",
  "quote.transfersLabel": "中转",
  "quote.totalDistance": "飞行距离",
  "quote.totalPrice": "总价",
  "quote.priceNote": "总距离为各航段之和；价格 = 总距离 × 0.13 USD。",
  "quote.confirm": "确认并出票",
  "quote.confirming": "出票中…",
  "quote.confirmed": "已出票",
  "quote.expires": "报价 15 分钟内有效",
  "quote.bookedNote": "客票 {id} 已出票，可在「我的机票」查看。",
  "quote.confirmError": "出票失败，报价可能已过期。",
  "quote.ticketFor": "一张客票 · 包含全部航段",

  "tickets.title": "我的机票",
  "tickets.subtitle": "你在 Ocean Above 预订的全部机票。",
  "tickets.empty": "还没有机票",
  "tickets.emptyHint": "在对话中确认报价后，机票会出现在这里。",
  "tickets.count": "共 {count} 张",
  "tickets.totalCount": "机票总数",
  "tickets.totalSpend": "总消费",
  "tickets.totalDistance": "总里程",
  "tickets.bookedAt": "出票时间 {time}",
  "tickets.bookedAtLabel": "出票时间",
  "tickets.passenger": "乘客",
  "tickets.ticketId": "客票",
  "tickets.bookAgain": "再订一张",

  "conversations.title": "历史会话",
  "conversations.subtitle": "你与 Ocean Above 的全部对话。",
  "conversations.empty": "暂无会话",
  "conversations.emptyHint": "开始聊天后，历史记录会显示在这里。",
  "conversations.messages": "{count} 条消息",
  "conversations.updated": "更新于 {time}",
  "conversations.open": "查看",
  "conversations.back": "全部会话",
  "conversations.notFound": "会话不存在。",
  "conversations.readOnly": "只读历史记录",

  "common.loading": "加载中…",
  "common.retry": "重试",
  "common.error": "请求失败",
  "common.new": "新建",
  "common.perLeg": "每段",
  "common.startChat": "开始对话",

  "footer.note": "路线与票价均由 locations.db 计算 · 价格 = 距离 × 0.13 USD",
};

export const dictionaries: Record<Lang, Dictionary> = { en, zh };

export const DEFAULT_LANG: Lang = "zh";

export function isLang(value: string | undefined | null): value is Lang {
  return value === "zh" || value === "en";
}

export function normalizeLang(value: string | undefined | null, fallback: Lang = DEFAULT_LANG): Lang {
  return isLang(value) ? value : fallback;
}

export const suggestions: Record<Lang, string[]> = {
  en: [
    "Cheapest flight from Chengdu to London",
    "How much is Guangzhou to Lima?",
    "Do you fly to Abu Dhabi?",
    "What tickets have I booked?",
  ],
  zh: [
    "成都到伦敦最便宜的航班",
    "广州到利马要多少钱？",
    "你们飞阿布扎比吗？",
    "我订过哪些机票？",
  ],
};
