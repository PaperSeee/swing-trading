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
  is_warning boolean not null default false,
  warning_reason text,
  r_value numeric(10, 2) not null,
  notes text,
  chart_url text,
  created_at timestamptz not null default now()
);

alter table public.trades add column if not exists is_warning boolean not null default false;
alter table public.trades add column if not exists warning_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'trades_warning_reason_required'
  ) then
    alter table public.trades
    add constraint trades_warning_reason_required
    check (
      (is_warning = true and warning_reason is not null and length(btrim(warning_reason)) > 0)
      or is_warning = false
    );
  end if;
end $$;

alter table public.backtest_sessions disable row level security;
alter table public.trades disable row level security;