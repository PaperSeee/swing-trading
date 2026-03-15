create extension if not exists pgcrypto;

create table if not exists public.backtest_sessions (
  id uuid primary key default gen_random_uuid(),
  pair text not null,
  month int not null check (month between 1 and 12),
  year int not null check (year between 2000 and 2100),
  created_at timestamptz not null default now()
);

create unique index if not exists uniq_backtest_session_period
on public.backtest_sessions (pair, month, year);

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.backtest_sessions(id) on delete cascade,
  trade_date date not null,
  side text not null check (side in ('long', 'short')),
  outcome text not null check (outcome in ('win', 'lose', 'be')),
  r_value numeric(10, 2) not null,
  notes text,
  chart_url text,
  created_at timestamptz not null default now()
);

alter table public.backtest_sessions disable row level security;
alter table public.trades disable row level security;