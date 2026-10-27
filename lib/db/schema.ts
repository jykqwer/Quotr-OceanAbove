export const SCHEMA = `
pragma journal_mode = WAL;
pragma foreign_keys = ON;

create table if not exists users (
  id            text primary key,
  username_key  text not null unique,
  username      text not null,
  display_name  text not null,
  password_hash text not null,
  created_at    text not null
);

create table if not exists sessions (
  id         text primary key,
  user_id    text not null references users(id) on delete cascade,
  created_at text not null,
  expires_at text not null
);
create index if not exists sessions_user on sessions(user_id);

create table if not exists conversations (
  id         text primary key,
  user_id    text not null references users(id) on delete cascade,
  title      text not null,
  created_at text not null,
  updated_at text not null
);
create index if not exists conversations_user on conversations(user_id, updated_at desc);

create table if not exists messages (
  id              text primary key,
  conversation_id text not null references conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null,
  quote_id        text,
  tools_json      text,
  created_at      text not null
);
create index if not exists messages_conversation on messages(conversation_id, created_at);

create table if not exists quotes (
  id            text primary key,
  user_id       text not null references users(id) on delete cascade,
  conversation_id text not null references conversations(id) on delete cascade,
  snapshot_json text not null,
  snapshot_hash text not null,
  status        text not null check (status in ('pending', 'booked', 'expired')),
  created_at    text not null,
  expires_at    text not null,
  confirmed_at  text
);
create index if not exists quotes_user on quotes(user_id, created_at desc);

create table if not exists confirmations (
  nonce         text primary key,
  quote_id      text not null references quotes(id) on delete cascade,
  user_id       text not null references users(id) on delete cascade,
  snapshot_hash text not null,
  created_at    text not null,
  expires_at    text not null,
  used_at       text
);
create index if not exists confirmations_quote on confirmations(quote_id);

create table if not exists tickets (
  id          text primary key,
  user_id     text not null references users(id) on delete cascade,
  quote_id    text not null unique references quotes(id),
  origin      text not null,
  destination text not null,
  total_km    real not null,
  price_usd   real not null,
  passenger   text not null,
  created_at  text not null
);
create index if not exists tickets_user on tickets(user_id, created_at desc);

create table if not exists ticket_legs (
  ticket_id   text not null references tickets(id) on delete cascade,
  seq         integer not null,
  from_city   text not null,
  to_city     text not null,
  distance_km real not null,
  primary key (ticket_id, seq)
);

create table if not exists audit_log (
  id            integer primary key autoincrement,
  user_id       text,
  action        text not null,
  quote_id      text,
  snapshot_hash text,
  detail        text,
  created_at    text not null
);
create index if not exists audit_action on audit_log(action, created_at desc);
`;
